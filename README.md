# Serverless Magento

A [Serverless framework](https://www.serverless.com) plugin for handling the registration of a microservices with the [magento2-microservice-config](https://bitbucket.org/aligent/magento2-microservice-config) module.

## Why?

Microservices registered with the [magento2-microservice-config](https://bitbucket.org/aligent/magento2-microservice-config) module will have a [Magento authentication token](https://devdocs.magento.com/guides/v2.4/get-started/authentication/gs-authentication-token.html) made available via [AWS SSM](https://docs.aws.amazon.com/systems-manager/latest/userguide/ssm-agent.html). This removes the need to manually create Magento integrations / access tokens for each service. The registration also provides the opportunity to create an "admin" interface within the Magento admin interface which can be used for managing the serverless application.

## Admin Interface

The admin interface is provided as a link to an externally hosted web application which is rendered in the Magento admin interface as an `iframe`. Authorisation context will be injected into the iframe when loaded.

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
    displayName: Service name that appears in Magento Admin
    permissions:
      - Magento_Backend::all
```

### Variables

| Variable              | Type    | Usage                                                                                                           |
| --------------------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| magentoUrl            | string  | The base URL - including scheme - of the Magento instance.                                                      |
| magentoApiToken       | string  | The api token for registering with Magento instance.                                                            |
| displayName           | string  | The name of the application/service.                                                                            |
| description           | string  | Short description about the application/service. If not provided, `resources/Description` will be used          |
| permission            | string  | Array of Magento permission. Webapp does not need this.                                                         |
| domainOutputKeyPrefix | string  | The prefix of webapp domain output key. The default value is `landingDomain`.                                   |
| errorOnFailure        | boolean | Whether the plugin should throw an error when a call to the Magento instance fails. The default value is `true` |
