# Serverless Magento Plugin

This serverless plugin provides scaffolding around a Magento-connected micro service.
It's main responsibility is registering the service with a Magento instance and injecting that authorization 
context into each function in the service.

The registration happens as part of the serverless deploy. If for any reason the registration is not able to take place, the deployment will fail (before any changeset has been deployed).

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
