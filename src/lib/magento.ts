import axios from 'axios';
import axiosRetry from 'axios-retry';

axiosRetry(axios, {
  retries: 3,
  shouldResetTimeout: true,
  retryCondition: (_error: any) => true // retry no matter what
});


export interface AdminConfiguration {
     name: string,
     app_url: string,
}

export interface RegistrationRequest {
     name: string,
}

export interface RegistratonResponse {
     name: string,
     service_id: string,
     registration_token: string
}

export interface RegistratonStatusResponse {
     name: string,
     status: string
}

export interface ActivationResponse {
     magento_access_token: string
}

const headers = {
     'Accept': 'application/json',
     'Content-Type': 'application/json'
};

export const register = (baseUrl: string, apiVersion: number, data: RegistrationRequest): Promise<RegistratonResponse> => {
     const registrationURL = `${baseUrl}/rest/V${apiVersion}/service/registration`;
     return  axios.post(registrationURL, data, {headers: headers, timeout: 3000})
     .then((res) => {return res.data});
}

export const getRegistrationStatus = (baseUrl: string, apiVersion: number, serviceId: number): Promise<RegistratonStatusResponse> => {
     const registrationURL = `${baseUrl}/rest/V${apiVersion}/service/${serviceId}/registration`;
     return  axios.get(registrationURL, {headers: headers, timeout: 3000})
     .then((res) => {return res.data});
}

export const activateRegistration = (baseUrl: string, apiVersion: number, serviceId: number, _registrationToken: String): Promise<ActivationResponse> => {
     const registrationURL = `${baseUrl}/rest/V${apiVersion}/service/${serviceId}/activation`;
     return  axios.post(registrationURL, {headers: headers, timeout: 3000})
     .then((res) => {return res.data});
}
