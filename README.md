# Serverless Magento Plugin

This serverless plug-in provides scaffolding around a Magento-connected micro service.

## YAML Definition
Add the following (with correct values) to your `serverless.yml` file:

```
custom:
  magento:
    baseUrl: 'http://localhost'
    name: 'Test Service'
    serviceId: '123'
    integrationId: '123'
    adminInterfaces: ['http://localhost']
```
 ## Variables

 | Variable              | Usage                                                       |
 | --------------------- | ----------------------------------------------------------- |
 | baseUrl               |  The base URL - including scheme - of the Magento instance.|
 | name     			 |  The friendly name of the service.|
 | serviceId             |  The service ID.|
 | integrationId         |  The Integration ID|
 | adminInterfaces       |  An array of strings representing the URLs of all admin interfaces to be exposed by Magento|
