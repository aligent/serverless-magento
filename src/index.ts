import type CloudFormation from 'aws-sdk/clients/cloudformation';
import axios, { AxiosInstance, isAxiosError } from 'axios';
import axiosRetry, {
    exponentialDelay,
    isNetworkOrIdempotentRequestError,
} from 'axios-retry';
import type Serverless from 'serverless';
import type ServerlessPlugin from 'serverless/classes/Plugin';
import type Service from 'serverless/classes/Service';
import type { Outputs } from 'serverless/plugins/aws/provider/awsProvider';

interface ServiceRegistration {
    magentoUrl: string;
    magentoApiToken: string;
    displayName: string;
    description?: string;
    permissions?: string[];
    domainOutputKeyPrefix: string;
}

type ServerlessResources = Service['resources'] & {
    Description?: string;
    Outputs?: Outputs;
};

interface ServerlessError extends Error {
    code: string;
}

interface ServerlessErrorConstructor {
    new (message?: string): ServerlessError;
    (message?: string): ServerlessError;
    readonly prototype: ServerlessError;
}

interface ServerlessClasses extends Serverless {
    classes?: { Error: ServerlessErrorConstructor };
}

// This is the default output key when webapp is deployed by `serverless-lift`
const DEFAULT_APP_URL_OUTPUT_KEY_PREFIX = 'landingDomain' as const;

class ServerlessMagento implements ServerlessPlugin {
    serverless: ServerlessClasses;
    options: Serverless.Options;
    hooks: ServerlessPlugin.Hooks;
    service: Service;
    log: ServerlessPlugin.Logging['log'];

    serviceRegistration: ServiceRegistration;

    axiosInstance: AxiosInstance;

    constructor(
        serverless: ServerlessClasses,
        options: Serverless.Options,
        { log }: { log: ServerlessPlugin.Logging['log'] },
    ) {
        this.serverless = serverless;
        this.options = options;
        this.service = serverless.service;
        this.log = log;

        this.serverless.configSchemaHandler.defineCustomProperties({
            type: 'object',
            properties: {
                serviceRegistration: {
                    type: 'object',
                    properties: {
                        magentoUrl: { type: 'string' },
                        magentoApiToken: { type: 'string' },
                        displayName: { type: 'string' },
                        description: { type: 'string' },
                        permissions: {
                            type: 'array',
                            items: { type: 'string' },
                        },
                        domainOutputKeyPrefix: { type: 'string' },
                    },
                    required: ['magentoUrl', 'magentoApiToken', 'displayName'],
                },
            },
        });

        this.hooks = {
            initialize: () => this.initialize(),
            'after:deploy:deploy': this.registerService.bind(this),
            'after:remove:remove': this.deregisterService.bind(this),
        };
    }

    private async initialize() {
        this.serviceRegistration = {
            ...this.service.custom.serviceRegistration,
            domainOutputKeyPrefix:
                this.service.custom.serviceRegistration.domainOutputKeyPrefix ||
                DEFAULT_APP_URL_OUTPUT_KEY_PREFIX,
        };

        this.axiosInstance = axios.create({
            baseURL: this.serviceRegistration.magentoUrl,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.serviceRegistration.magentoApiToken}`,
            },
        });

        axiosRetry(this.axiosInstance, {
            retryCondition: (error) => {
                return isNetworkOrIdempotentRequestError(error);
            },
            retryDelay: (retryCount) =>
                exponentialDelay(retryCount, undefined, 3000),
            onRetry: (retryCount, error) =>
                this.log.info(
                    `Retrying ${retryCount} due to ${error.toString()}`,
                ),
            retries: 3,
        });
    }

    /**
     * Perform a registration request against the Magento instance
     */
    private async registerService() {
        const { displayName, description, domainOutputKeyPrefix, permissions } =
            this.serviceRegistration;

        const serviceName = this.service.service;

        this.log.info(`Registering service with Magento`);

        try {
            await this.axiosInstance.put(`/rest/V1/service/registrations`, {
                app_name: serviceName,
                display_name: displayName,
                description: description || this.getServiceDescription(),
                app_url: await this.getAppUrlFromStackOutput(
                    domainOutputKeyPrefix,
                ),
                permissions: permissions || [],
            });

            this.log.success(
                `Successfully registered ${serviceName} with Magento`,
            );
        } catch (error) {
            let errorMessage = `Unable to register ${serviceName} with Magento due to: ${(
                error as Error
            ).toString()}`;

            if (isAxiosError(error)) {
                errorMessage += `\nResponse: ${JSON.stringify(
                    error.response?.data,
                )}`;
            }

            throw new this.serverless.classes.Error(errorMessage);
        }
    }

    /**
     * Perform a registration request against the Magento instance
     */
    private async deregisterService() {
        const serviceName = this.service.service;

        this.log.info(`De-registering service with Magento`);

        try {
            await this.axiosInstance.delete(
                `/rest/V1/service/registrations/${serviceName}`,
            );

            this.log.success(
                `Successfully de-registered ${serviceName} from Magento`,
            );
        } catch (error) {
            let errorMessage = `Unable to de-register ${serviceName} with Magento due to: ${(
                error as Error
            ).toString()}`;

            if (isAxiosError(error)) {
                errorMessage += `\nResponse: ${JSON.stringify(
                    error.response?.data,
                )}`;
            }

            throw new this.serverless.classes.Error(errorMessage);
        }
    }

    private async getAppUrlFromStackOutput(outputKeyPrefix: string) {
        const provider = this.serverless.getProvider('aws');
        const serviceName = this.service.getServiceName();
        const stackName = `${serviceName}-${provider.getStage()}`;

        try {
            this.log.info(`Getting stack output of ${serviceName}`);

            const data = await provider.request(
                'CloudFormation',
                'describeStacks',
                { StackName: stackName },
                { region: provider.getRegion(), useCache: true },
            );

            const stackOutputs = data.Stacks[0]
                .Outputs as CloudFormation.Outputs;
            if (!stackOutputs) {
                throw new Error(`Unable to describe stack: ${serviceName}`);
            }

            const domainOutput = stackOutputs.filter(
                (output) => output.OutputKey?.startsWith(outputKeyPrefix),
            )[0];

            if (!domainOutput || !domainOutput.OutputValue) {
                this.log.verbose(
                    `No appUrl found for output key prefix: ${outputKeyPrefix}`,
                );
            }

            return domainOutput?.OutputValue
                ? `https://${domainOutput.OutputValue}`
                : '';
        } catch (error) {
            this.log.error((error as Error).toString());
            throw error;
        }
    }

    private getServiceDescription() {
        return (
            (this.service.resources as ServerlessResources).Description || ''
        );
    }
}

module.exports = ServerlessMagento;
