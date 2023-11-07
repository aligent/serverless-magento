# Serverless Magento

A [Serverless framework](https://www.serverless.com) plugin for handling the registration of a microservices with the [magento2-microservice-config](https://bitbucket.org/aligent/magento2-microservice-config) module.

## Why?

Microservices registered with the [magento2-microservice-config](https://bitbucket.org/aligent/magento2-microservice-config) module will have a [Magento authentication token](https://devdocs.magento.com/guides/v2.4/get-started/authentication/gs-authentication-token.html) made available via [AWS SSM](https://docs.aws.amazon.com/systems-manager/latest/userguide/ssm-agent.html). This removes the need to manually create Magento integrations / access tokens for each service. The registration also provides the opportunity to create an "admin" interface within the Magento admin interface which can be used for managing the serverless application.

## Admin Interface

The admin interface is provided as a link to an externally hosed web application which is rendered in the Magento admin interface as an `iframe`. Authorisation context will be injected into the iframe when loaded.

## Deployment

The Serverless plugin will initially register with the [magento2-microservice-config](https://bitbucket.org/aligent/magento2-microservice-config) REST API. At this state the service is "registered" but not "active". A service does not become "active" until an admin user approves it.

## Serverless configuration

The plugin is configured within the `serverless.yaml` by providing configuration values.

### Example

```yaml
custom:
  serviceRegistration:
    magentoUrl: https://magento.domain.name
    magentoApiToken: ${ssm:/magento/api/access-token-for-registration}
    displayName: 'Service name that appears in Magento Admin'
    description: 'Short description about the service'
    appUrl: https://web-app-url.on.cloudfront
    permissions: # Webapp does not need this
      - All
```

### Variables

| Variable    | Usage                                                                                   |
| ----------- | --------------------------------------------------------------------------------------- |
| magentoUrl  | The base URL - including scheme - of the Magento instance.                              |
| displayName | The name of the application/service.                                                    |
| description | Short description about the application/service.                                        |
| appUrl      | The url to access webapp (Only applicable for webapp, other service does not need this) |
| permission  | Array of Magento permission. Webapp does not need this                                  |
