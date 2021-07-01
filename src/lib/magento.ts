import axios, { AxiosResponse } from 'axios';
const axiosRetry = require('axios-retry');
import 'source-map-support/register';

axiosRetry(axios, {
  retries: 3,
  shouldResetTimeout: true,
  retryCondition: (_error: any) => true // retry no matter what
});

export interface RegistrationRequest {
     service_id: string,
     name: string,
     admin_interfaces: string[],
     integration_id: string
}

export interface RegistratonResponse {
     success: boolean,
     service_id: string,
     access_token: string
}

const headers = {
     'Accept': 'application/json',
     'Content-Type': 'application/json'
};

export const register = (baseUrl: string, apiVersion: number, data: RegistrationRequest): Promise<RegistratonResponse> => {
     const registrationURL = `${baseUrl}/v${apiVersion}/service/register`;
     return  axios.post(registrationURL, data, {headers: headers, timeout: 3000})
     .then((res) => {return res.data});
}
