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
    adminInterfaces:
      - name: 'Configuration'
        app_url: 'https://example.com'
```

## Variables

| Variable              | Usage                                                       |
| --------------------- | ----------------------------------------------------------- |
| baseUrl               |  The base URL - including scheme - of the Magento instance.|
| name     			 |  The friendly name of the service.|
| adminInterfaces       |  An array of {name, app_url} representing the admin interfaces to be exposed by Magento|
