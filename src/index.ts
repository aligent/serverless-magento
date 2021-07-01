import Serverless = require("serverless");
import { Options } from "serverless";
import { register, RegistrationRequest, RegistratonResponse } from './lib/magento'
const chalk = require('chalk');
import axios from 'axios';
import 'source-map-support/register';

class ServerlessMagento {
     serverless: Serverless;
     options: any;

     hooks: { [key: string]: Function }
     variables: { [key: string]: any }
     serviceName: string
     baseUrl: string
     serviceId: string
     integrationId: string
     adminInterfaces: string[]



     constructor(serverless: Serverless, options: Options) {
          this.serverless = serverless;
          this.options = options;
          this.variables = serverless.service.custom['magento'];
          this.serviceName = this.variables['name']
          this.baseUrl = this.variables['baseUrl']
          this.serviceId= this.variables['serviceId']
          this.integrationId = this.variables['integrationId']
          this.adminInterfaces = this.variables['adminInterfaces']

          this.hooks = {
               'aws:common:validate:validate': this.run.bind(this),
          };
     }

     run() {
          this.validateConfig();
          this.serviceRegistration();
     }

     validateConfig() {
          var valid = true
          const configValues = {
               'serviceName': this.serviceName,
               'baseUrl': this.baseUrl,
               'serviceId': this.serviceId,
               'integrationId': this.integrationId,
               'adminInterfaces': this.adminInterfaces
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
               this.serverless.cli.log(chalk.red((`Invalid service configuration.`));
               this.serverless.cli.log(chalk.red(`adminInterfaces should be an array of urls.`));
               valid = false;
          }

          if (!valid) {
               throw new Error('Failed to validate service configuration.');
          }
     }

     async serviceRegistration() {
          this.serverless.cli.log(`Registering service with Magento application`);

          const registrationRequest = {
               service_id: this.serviceId,
               name: this.serviceName,
               admin_interfaces: this.adminInterfaces,
               integration_id: this.integrationId
          } as RegistrationRequest;


          const response: RegistratonResponse = await register(this.baseUrl, 1, registrationRequest)
          if (response.success == true) {
               this.serverless.cli.log(chalk.gree('Magento service registration successful'));
          } else {
               this.serverless.cli.log(chalk.red('Magento service registration failed'));
               throw new Error('Unknown registration error. Magento returned failure message.');
          }
     }
}

module.exports = ServerlessMagento;

