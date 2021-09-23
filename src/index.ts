import Serverless = require("serverless");
import { Options } from "serverless";
import { SSM, AWSError} from 'aws-sdk';
import { register, RegistrationRequest, RegistratonResponse, AdminConfiguration } from './lib/magento'
const chalk = require('chalk');
import { AxiosError } from 'axios';
import path = require('path');
import {addActivatorFunctionRoleToResources,
     addActivatorFunctionToService,
     createActivatorFunctionArtifact} from './lib/activator'
import fs  = require('fs/promises');
import 'source-map-support/register';

const ACTIVATOR_FUNCTION_DIR='activator';

class ServerlessMagento {
     private ssm?: SSM;

     serverless: Serverless;
     options: any;
     provider: any;
     region?: string;

     hooks: { [key: string]: Function }

     variables: { [key: string]: any }
     magentoServiceName: string
     baseUrl: string
     adminInterfaces: AdminConfiguration[]
     serviceDir: string
     handlerFolder: string
     ssmPrefix: string

     constructor(serverless: Serverless, options: Options) {
          this.serverless = serverless;
          this.options = options;
          this.variables = serverless.service.custom['magento'];
          this.magentoServiceName = this.variables['name']
          this.baseUrl = this.variables['baseUrl']
          this.adminInterfaces = this.variables['adminInterfaces']

          this.hooks = {
               'after:package:initialize': this.initialize.bind(this),
               'after:package:createDeploymentArtifacts': this.cleanupTempDir.bind(this),
               'after:deploy:deploy': this.injectInterfaceContext.bind(this)
          };

          this.serviceDir = this.serverless.config.servicePath || '';
          this.handlerFolder = path.join(this.serviceDir, ACTIVATOR_FUNCTION_DIR);
          this.ssmPrefix = `/${this.serverless.service.service}/${this.serverless.service.provider.stage}/magento`;
     }

     async initialize() {
          // Initialize AWS SDK clients
          this.provider = this.serverless.getProvider('aws');
          this.region = this.serverless.service.provider.region;
          const credentials = this.provider.getCredentials(); 
          const credentialsWithRegion = { ...credentials, region: this.region };
          this.ssm = new this.provider.sdk.SSM(credentialsWithRegion);

          this.validateConfig();
 
          if (await this.serviceParamsPresent()) {
               this.serverless.cli.log(`Service already registered. Skipping registration.`);
          } else {
               await this.performServiceRegistration()
               .then(this.writeRegistrationSSMParams)
               //TODO: Deregister if failure
          }

          await this.buildActivatorFunction();
     }

     validateConfig() {
          var valid = true
          const configValues = {
               'serviceName': this.magentoServiceName,
               'baseUrl': this.baseUrl,
          }

          Object.entries(configValues).forEach(entry => {
               const [key, value] = entry;
               if (!value) {
                    this.serverless.cli.log(chalk.red('Invalid service configuration.'));
                    this.serverless.cli.log(chalk.red(`Missing value for ${key}`));
                    valid = false;
               }
          });


          if (!Array.isArray(this.adminInterfaces)) {
               this.serverless.cli.log(chalk.red(`Invalid service configuration.`));
               this.serverless.cli.log(chalk.red(`adminInterfaces should be an array of AdminConfigurations.`));
               valid = false;
          }

          if (!valid) {
               throw new Error('Failed to validate service configuration.');
          }
     }

     /**
      * Perform a registration request against the Magento instance
      */
     performServiceRegistration(): Promise<RegistratonResponse> {
          this.serverless.cli.log(`Registering service with Magento application`);

          const registrationRequest = {
               name: this.magentoServiceName,
               admin_interfaces: this.adminInterfaces,
          } as RegistrationRequest;

          return register(this.baseUrl, 1, registrationRequest)
          .catch((err: AxiosError) => {
               this.serverless.cli.log(chalk.red('Magento service registration failed'));
               if (err.response?.data != null) {
                    this.serverless.cli.log(chalk.red("Received registration error:"));
                    this.serverless.cli.log(chalk.red(JSON.stringify(err.response!.data)));
               }
               throw err;
          });

     }

     /**
      * Tests for the presence of a registration token SSM param indicating 
      */
     serviceParamsPresent = (): Promise<boolean> => {

          return this.ssm!.getParameters({
               Names: [`${this.ssmPrefix}/registration_token`]
          }).promise()
          .then((res) => {
               return (res.Parameters?.length ?? 0) == 1
          });
     }

     /**
      * Writes Magento service registration information to SSM.
     */
     writeRegistrationSSMParams = (registration: RegistratonResponse): Promise<SSM.PutParameterResult[]>  => {
          this.serverless.cli.log(`Writing service context to SSM`);

          return Promise.all(
          [
               // Write Magento URL to SSM
               this.ssm!.putParameter(
               {
                    Name: `${this.ssmPrefix}/url`,
                    Description: 'Written by @aligent/serverless-magento',
                    Value: this.baseUrl,
                    Type: 'String'
               }).promise(),
               // Write serviceId to SSM
               this.ssm!.putParameter(
               {
                    Name: `${this.ssmPrefix}/service_name`,
                    Description: 'Written by @aligent/serverless-magento',
                    Value: registration.name,
                    Type: 'String'
               }).promise(),
               // Write serviceId to SSM
               this.ssm!.putParameter(
               {
                    Name: `${this.ssmPrefix}/service_id`,
                    Description: 'Written by @aligent/serverless-magento',
                    Value: registration.service_id.toString(),
                    Type: 'String'
               }).promise(),
               this.ssm!.putParameter(
               {
                    Name: `${this.ssmPrefix}/registration_token`,
                    Description: 'Written by @aligent/serverless-magento',
                    Value: registration.registration_token,
                    Type: 'SecureString'
               }).promise()
          ]);

          
     }

     cleanupTempDir = async () => {
          try {
               await fs.rm(
                    this.handlerFolder,
                    { recursive: true },
               );
          } catch (err: any) {
               if (err.code !== 'ENOENT') {
                    this.serverless.cli.log(`Couldn't clean up temporary directory ${this.handlerFolder}.`);
               }
          }
     }

     /**
      * Packages and injects a activator function and associated
      * resources into stack.
      */
     buildActivatorFunction = async () => {
          const activatorConfig = {
               serviceName: this.serverless.service.service,
               serviceStage: this.serverless.service.provider.stage,
               pathHandler: path.join('activator', 'index.activate'),
               memorySize: 128,
               events: [{ schedule: 'rate(5 minutes)' }],
               timeout: 20,
               role: 'ServerlessMagentoActivatorPluginRole'
          };

          await createActivatorFunctionArtifact(
               this.serverless.service.provider.region,
               this.handlerFolder,
               this.ssmPrefix,
               this.adminInterfaces[0].name,
               this.adminInterfaces[0].app_url,
          );

          addActivatorFunctionRoleToResources(
               this.serverless.service,
               this.ssmPrefix
          );

          addActivatorFunctionToService(this.serverless.service, activatorConfig);
     }

     injectInterfaceContext = async () => {
          this.serverless.cli.log(`Writing APIGateway context to SSM`);

          const apiGatewayKey = await this.provider
          .request('CloudFormation', 'describeStackResources', {
               StackName: this.provider.naming.getStackName(),
          })
          .then((resources: any) => {
               const apiKeys = resources.StackResources
               .filter((resource: any) => resource.ResourceType === 'AWS::ApiGateway::ApiKey')
               .map((resource: any) => resource.PhysicalResourceId)

               if (apiKeys.length > 1) {
                    throw new Error('Multiple APIGateway keys not supported');
               }
               const keyId = apiKeys.pop();

               return this.provider.request('APIGateway', 'getApiKey', {
                    apiKey: keyId,
                    includeValue: true,
               });
          })
          .then((apiKeys: any) => {
               return apiKeys.value;
          });

          const apiGatewayBaseUrl = await this.provider
          .request('CloudFormation', 'describeStackResources', {
               StackName: this.provider.naming.getStackName(),
          })
          .then((resources: any) => {
               const apiRestApis = resources.StackResources
               .filter((resource: any) => resource.ResourceType === 'AWS::ApiGateway::RestApi')
               .map((resource: any) => resource.PhysicalResourceId)

               if (apiRestApis.length > 1) {
                    throw new Error('Multiple APIGatewayRestApis not supported');
               } else if (apiRestApis.length == 0) {
                    throw new Error('Multiple APIGatewayRestApis');
               }

               const restApiId = apiRestApis.pop();
               return `https://${restApiId}.execute-api.${this.region}.amazonaws.com/${this.serverless.service.provider.stage}/`
          });

          await this.ssm!.putParameter({
               Name: `${this.ssmPrefix}/interface_context`,
               Description: 'Written by @aligent/serverless-magento',
               Value: JSON.stringify({apiBasePath: apiGatewayBaseUrl, apiKey: apiGatewayKey}),
               Type: 'SecureString'
          }).promise();

     }
}

module.exports = ServerlessMagento;

