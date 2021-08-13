import Serverless = require("serverless");
import { Options } from "serverless";
import { SSM } from 'aws-sdk';
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
     private ssm: SSM;

     serverless: Serverless;
     options: any;
     provider: any;
     region: string;

     hooks: { [key: string]: Function }

     variables: { [key: string]: any }
     magentoServiceName: string
     baseUrl: string
     adminInterfaces: AdminConfiguration[]
     serviceDir: string
     handlerFolder: string

     constructor(serverless: Serverless, options: Options) {
          this.serverless = serverless;
          this.options = options;
          this.variables = serverless.service.custom['magento'];
          this.magentoServiceName = this.variables['name']
          this.baseUrl = this.variables['baseUrl']
          this.adminInterfaces = this.variables['adminInterfaces']
          this.provider = this.serverless.getProvider('aws');
          this.region = this.serverless.service.provider.region;

          this.hooks = {
               'after:package:initialize': this.initialize.bind(this),
               'after:package:createDeploymentArtifacts': this.cleanupTempDir.bind(this)
          };

          this.serviceDir = this.serverless.config.servicePath || '';
          this.handlerFolder = path.join(this.serviceDir, ACTIVATOR_FUNCTION_DIR);
     }

     async initialize() {
          // Initialize AWS SDK clients
          const credentials = this.provider.getCredentials(); 
          const credentialsWithRegion = { ...credentials, region: this.region };
          this.ssm = new this.provider.sdk.SSM(credentialsWithRegion);

          this.validateConfig();
 
          // TODO: Test for existing registration
          this.performServiceRegistration()
          .then(this.writeRegistrationSSMParams)
          .then(this.buildActivatorFunction);
          //TODO: Deregister if failure
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
      * Writes Magento service registration information to SSM.
     */
     writeRegistrationSSMParams = (registration: RegistratonResponse): Promise<SSM.PutParameterResult[]>  => {
          this.serverless.cli.log(`Writing service context to SSM`);
          const SSM_PREFIX = `/${this.serverless.service.service}/${this.serverless.service.provider.stage}/magento`

          return Promise.all(
          [
               // Write Magento URL to SSM
               this.ssm.putParameter(
               {
                    Name: `${SSM_PREFIX}/url`,
                    Description: 'Written by @aligent/serverless-magento',
                    Value: this.baseUrl,
                    Type: 'String'
               }).promise(),
               // Write serviceId to SSM
               this.ssm.putParameter(
               {
                    Name: `${SSM_PREFIX}/service_name`,
                    Description: 'Written by @aligent/serverless-magento',
                    Value: registration.name,
                    Type: 'String'
               }).promise(),
               // Write serviceId to SSM
               this.ssm.putParameter(
               {
                    Name: `${SSM_PREFIX}/service_id`,
                    Description: 'Written by @aligent/serverless-magento',
                    Value: registration.service_id.toString(),
                    Type: 'String'
               }).promise(),
               this.ssm.putParameter(
               {
                    Name: `${SSM_PREFIX}/registration_token`,
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
          } catch (err) {
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
          };

          await createActivatorFunctionArtifact(
               this.region,
               this.handlerFolder
          );

          addActivatorFunctionRoleToResources(
               this.serverless.service
          );

          addActivatorFunctionToService(this.serverless.service, activatorConfig);
     }


}


module.exports = ServerlessMagento;

