import Serverless = require("serverless");
import { Options } from "serverless";
import { register, RegistrationRequest, RegistratonResponse, AdminConfiguration } from './lib/magento'
const chalk = require('chalk');
import axios from 'axios';
import { AxiosError } from 'axios';
import 'source-map-support/register';

class ServerlessMagento {
     serverless: Serverless;
     options: any;

     hooks: { [key: string]: Function }
     variables: { [key: string]: any }
     serviceName: string
     baseUrl: string
     adminInterfaces: AdminConfiguration[]

     constructor(serverless: Serverless, options: Options) {
          this.serverless = serverless;
          this.options = options;
          this.variables = serverless.service.custom['magento'];
          this.serviceName = this.variables['name']
          this.baseUrl = this.variables['baseUrl']
          this.adminInterfaces = this.variables['adminInterfaces']

          this.hooks = {
               'before:package:compileFunctions': this.createDeploymentArtifacts.bind(this),
          };
     }

     async createDeploymentArtifacts() {
          this.validateConfig();
          await this.performServiceRegistration()
          .then((res: RegistratonResponse) => {
               return this.injectServiceContext(res);
          });

     }

     validateConfig() {
          var valid = true
          const configValues = {
               'serviceName': this.serviceName,
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
               name: this.serviceName,
               admin_interfaces: this.adminInterfaces,
          } as RegistrationRequest;


          return register(this.baseUrl, 1, registrationRequest)
          .then ((res) => {
               if (res.success == true) {
                    this.serverless.cli.log(chalk.green('Magento service registration successful'));
               } else {
                    this.serverless.cli.log(chalk.red('Magento service registration failed'));
                    throw new Error('Unknown registration error. Magento returned failure message.');
               }
               return res
          }).catch((err: AxiosError) => {
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

               functionObj.environment.MAGENTO_ACCESS_TOKEN=registrationResponse.access_token;
               functionObj.environment.MAGENTO_SERVICE_ID=registrationResponse.service_id;
          });
     }

}

module.exports = ServerlessMagento;

