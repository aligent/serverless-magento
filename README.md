# Serverless Magento

A [Serverless framework](https://www.serverless.com)  plugin for handling the registration of a Serverless application with the [magento2-microservice-config](https://bitbucket.org/aligent/magento2-microservice-config) module.

## Why?

Serverless applications registered with the [magento2-microservice-config](https://bitbucket.org/aligent/magento2-microservice-config) module will have a [Magento authentication token](https://devdocs.magento.com/guides/v2.4/get-started/authentication/gs-authentication-token.html) made available via [AWS SSM](https://docs.aws.amazon.com/systems-manager/latest/userguide/ssm-agent.html). This removes the need to manually create Magento integrations / access tokens for each Serverless application. The registration also provides the opportunity to create an "admin" interface within the Magento admin interface which can be used for managing the serverless application.

## Admin Interface
The admin interface is provided as a link to an externally hosted web application which is rendered in the Magento admin interface as an `iframe`. Authorisation context will be injected into the iframe when loaded. 

## Deployment
The registration happens as part of the Serverless deploy. If for any reason the registration is not able to take place, the deployment will fail (before any change set has been deployed).

The Serverless plugin will initially register with the [magento2-microservice-config](https://bitbucket.org/aligent/magento2-microservice-config) REST API.  At this state the service is "registered" but not "active". A service does not become "active" until an admin user approves it.

An "activator" Lambda function will be deployed along with the Serverless application which repeatedly checks if the service has been "activated" within Magento. Once this is done, any provided admin interface is created and the Magento access token is retrieved and stored within SSM for use by the application.

![serverless output](/images/serverless_output.png)


## Serverless configuration
The plugin is configured within the `serverless.yaml` by providing configuration values.

### Example 
```
custom:
  magento:
    baseUrl: 'http://localhost'
    name: 'Test Service'
    adminInterfaces:
      - name: 'Configuration'
        app_url: 'https://example.com'
```

### Variables

| Variable              | Usage                                                       |
| --------------------- | ----------------------------------------------------------- |
| baseUrl               |  The base URL - including scheme - of the Magento instance.|
| name     			 |  The friendly name of the service.|
| adminInterfaces       |  An array of {name, app_url} representing the admin interfaces to be exposed by Magento|

