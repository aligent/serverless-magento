import fs  = require('fs/promises');
import path = require('path');
import { exec } from 'child_process';

export function addActivatorFunctionRoleToResources(service: any, ssmPrefix: string) {

     const stage = service.provider.stage

     if (typeof service.resources !== 'object') {
          service.resources = {};
     }
     if (typeof service.resources.Resources !== 'object') {
          service.resources.Resources = {};
     }

     service.resources.Resources['ServerlessMagentoActivatorPluginRole'] = {
          Type: 'AWS::IAM::Role',
          Properties: {
               Path: '/',
               RoleName: {
                    'Fn::Join': [
                         '-',
                         [
                              service.service,
                              stage,
                              { Ref: 'AWS::Region' },
                              'activator',
                              'role',
                         ],
                    ],
               },
               AssumeRolePolicyDocument: {
                    Version: '2012-10-17',
                    Statement: [
                         {
                              Effect: 'Allow',
                              Principal: {
                                   Service: [
                                        'lambda.amazonaws.com',
                                   ],
                              },
                              Action: 'sts:AssumeRole',
                         },
                    ],
               },
               Policies: [
                    {
                         PolicyName: {
                              'Fn::Join': [
                                   '-',
                                   [
                                        service.service,
                                        stage,
                                        'serverless-magento',
                                        'acivator',
                                        'policy',
                                   ],
                              ],
                         },
                         PolicyDocument: {
                              Version: '2012-10-17',
                              Statement: [
                                   {
                                        Effect: 'Allow',
                                        Action: [
                                             'logs:CreateLogGroup',
                                             'logs:CreateLogStream',
                                        ],
                                        Resource: [{
                                             'Fn::Sub': `arn:\${AWS::Partition}:logs:\${AWS::Region}:\${AWS::AccountId}:log-group:/aws/lambda/serverless-magento-activator:*`,
                                        }],
                                   },
                                   {
                                        Effect: 'Allow',
                                        Action: [
                                             'logs:PutLogEvents',
                                        ],
                                        Resource: [{
                                             'Fn::Sub': `arn:\${AWS::Partition}:logs:\${AWS::Region}:\${AWS::AccountId}:log-group:/aws/lambda/serverless-magento-activator:*:*`,
                                        }],
                                   },
                                   {
                                        Effect: 'Allow',
                                        Action: [
                                             'ec2:CreateNetworkInterface',
                                             'ec2:DescribeNetworkInterfaces',
                                             'ec2:DetachNetworkInterface',
                                             'ec2:DeleteNetworkInterface',
                                        ],
                                        Resource: '*',
                                   },
                                   {
                                        Effect: 'Allow',
                                        Action: [
                                             'ssm:GetParameter',
                                             'ssm:PutParameter'
                                        ],
                                        Resource: [{
                                             'Fn::Sub': `arn:aws:ssm:\${AWS::Region}:\${AWS::AccountId}:parameter${ssmPrefix}/*`,
                                        }],
                                   },
                              ],
                         },
                    },
               ],
          },
     };
}

export async function createActivatorFunctionArtifact(region: string,
                                                      handlerFolder: string,
                                                      ssmPrefix: string,
                                                      interfaceName: string,
                                                      interfaceAppUrl: string) {
     const activatorFunction = `'use strict';
     /** Generated by Serverless magentoactivate-serverless **/
          const AWS = require('aws-sdk');
          const axios = require('axios');

          const createServiceinterface = async (baseUrl, registrationToken, serviceId, interfaceName, interfaceAppUrl, interfaceContext) => {
               const headers = {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'registration-token': registrationToken
               };

               const registrationURL = \`\${baseUrl}/rest/V1/service/\${serviceId}/interface\`;

               return  axios.post(registrationURL, {
                         "name": interfaceName,
                         "app_url": interfaceAppUrl,
                         "interface_context": interfaceContext
               }, {headers: headers, timeout: 3000});
          };

          const activateService = async (baseUrl, registrationToken, serviceId) => {
               const headers = {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'registration-token': registrationToken
               };

               const registrationURL = \`\${baseUrl}/rest/V1/service/\${serviceId}/activation\`;

               return  axios.post(registrationURL, {}, {headers: headers, timeout: 3000})
               .then((res) => {
                    return res.data.magento_api_token;
               })
               .catch((err) => {
                    return null;
               });
          };

          module.exports.activate = async (event, context) => {
               const ssm = new AWS.SSM('${region}');
               const ag = new AWS.APIGateway('${region}');

               let accessTokenRequest = (await ssm.getParameter({
                    Name: '${ssmPrefix}/access_token',
                    WithDecryption: false
               }).promise().catch((err) => {
                    return null;
               }));


               if (!accessTokenRequest) {
                    console.log('Attempting Activation');
                    let magentoUrl = (await ssm.getParameter({
                         Name: '${ssmPrefix}/url',
                         WithDecryption: false
                    }).promise()).Parameter.Value;

                    let serviceId = (await ssm.getParameter({
                         Name: '${ssmPrefix}/service_id',
                         WithDecryption: false
                    }).promise()).Parameter.Value;

                    let registrationToken = (await ssm.getParameter({
                         Name: '${ssmPrefix}/registration_token',
                         WithDecryption:true
                    }).promise()).Parameter.Value;

                    let interfaceContext = "";
                    try {
                         interfaceContext = (await ssm.getParameter({
                              Name: '${ssmPrefix}/interface_context',
                              WithDecryption: true
                         }).promise()).Parameter.Value;
                    } catch {
                         console.debug('No interface context available');
                    }

                    let magentoToken = await activateService(magentoUrl, registrationToken, serviceId);
                    if (magentoToken) {
                         console.log('Service activated. Writing to SSM and creating service interface');
                         await ssm.putParameter({
                                   Name: '${ssmPrefix}/access_token',
                                   Description: 'Written by @aligent/serverless-magento',
                                   Value: magentoToken,
                                   Type: 'SecureString'
                              }).promise();

                         await createServiceinterface(magentoUrl, registrationToken, serviceId, '${interfaceName}', '${interfaceAppUrl}', interfaceContext);
                    } else {
                         console.log('Service activation failed. Has it been approved?');
                    }

               } else {
                    console.log('Service already activated.');
               }

          }`;

          await fs.mkdir(handlerFolder, { recursive: true });
          exec('npm init -y', { cwd: handlerFolder });
          exec('npm install --save aws-sdk', { cwd: handlerFolder });
          exec('npm install --save axios', { cwd: handlerFolder });
          await fs.writeFile(path.join(handlerFolder, 'index.js'), activatorFunction);
}

export function addActivatorFunctionToService(service: any, activatorConfig: any) {
     service.functions['magentoServerlessActivator1'] = {
          description: `Scheduled function which ensures the Magento integration  context is fresh`,
          events: activatorConfig.events,
          handler: activatorConfig.pathHandler.split(path.sep).join(path.posix.sep),
          memorySize: activatorConfig.memorySize,
          name: `${activatorConfig.serviceName}-${activatorConfig.serviceStage}-magentoServerlessActivator1`,
    runtime: 'nodejs14.x',
    package: activatorConfig.package,
    timeout: activatorConfig.timeout,
    role: activatorConfig.role

  };
}
