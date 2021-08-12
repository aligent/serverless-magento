import Serverless = require("serverless");
import { Options } from "serverless";
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
     serverless: Serverless;
     options: any;

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

          this.hooks = {
               'after:package:initialize': this.initialize.bind(this),
               'after:package:createDeploymentArtifacts': this.cleanupTempDir.bind(this)
          };

          this.serviceDir = this.serverless.config.servicePath || '';
          this.handlerFolder = path.join(this.serviceDir, ACTIVATOR_FUNCTION_DIR);
     }

     async initialize() {
          this.validateConfig();
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

     injectServiceContext(registrationResponse: RegistratonResponse)  {
          this.serverless.cli.log(`Injecting Magento service context into functions`);

          this.serverless.service.getAllFunctions().forEach((functionName) => {
               const functionObj = this.serverless.service.getFunction(functionName);
               if (functionObj.environment == null) {
                    functionObj.environment = {};
               }
          });
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
               this.serverless.service.provider.region,
               this.handlerFolder
          );

          addActivatorFunctionRoleToResources(
               this.serverless.service
          );

          addActivatorFunctionToService(this.serverless.service, activatorConfig);
     }


}


module.exports = ServerlessMagento;

