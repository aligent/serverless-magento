import axios, { AxiosInstance } from 'axios';
import axiosRetry, {
    exponentialDelay,
    isNetworkOrIdempotentRequestError,
} from 'axios-retry';
import type Serverless from 'serverless';
import type ServerlessPlugin from 'serverless/classes/Plugin';
import type Service from 'serverless/classes/Service';

interface ServiceRegistration {
    magentoUrl: string;
    magentoApiToken: string;
    displayName: string;
    description?: string;
    appUrl?: string;
    permissions?: string[];
}

class ServerlessMagento implements ServerlessPlugin {
    serverless: Serverless;
    options: Serverless.Options;
    hooks: ServerlessPlugin.Hooks;
    service: Service;
    log: ServerlessPlugin.Logging['log'];

    serviceRegistration: ServiceRegistration;

    axiosInstance: AxiosInstance;

    constructor(
        serverless: Serverless,
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
                        appUrl: { type: 'string' },
                        permissions: {
                            type: 'array',
                            items: { type: 'string' },
                        },
                    },
                    require: ['magentoUrl', 'magentoApiToken', 'displayName'],
                },
            },
        });

        this.serviceRegistration = this.service.custom.serviceRegistration;

        this.axiosInstance = axios.create({
            baseURL: this.serviceRegistration.magentoUrl,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.serviceRegistration.magentoApiToken}`,
            },
        });

        this.hooks = {
            'after:deploy:deploy': this.performServiceRegistration.bind(this),
        };
    }

    async initialize() {
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
    async performServiceRegistration() {
        this.log.info(`Registering service with Magento application`);

        const { displayName, description, appUrl, permissions, magentoUrl } =
            this.serviceRegistration;

        const serviceName = this.service.service;

        try {
            await this.axiosInstance.put(`/v1/service/registrations`, {
                app_name: serviceName,
                display_name: displayName,
                description: description || '',
                app_url: appUrl || '',
                permissions: permissions || [],
            });

            this.log.info(
                `Successfully registered ${serviceName} to ${magentoUrl}`,
            );
        } catch (error) {
            this.log.error((error as Error).toString());
            throw error;
        }
    }
}

module.exports = ServerlessMagento;
