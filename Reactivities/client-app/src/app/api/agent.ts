import axios, { AxiosError, AxiosResponse } from 'axios';
import { toast } from 'react-toastify';
import { URLSearchParams } from 'url';
import { history } from '../..';
import { Activity, ActivityFormValues } from '../model/activity';
import { PaginatedResult } from '../model/pagination';
import { Photo, Profile, UserActivity } from '../model/profile';
import { User, UserFormValues } from '../model/user';
import { store } from '../stores/store';

const sleep = (delay: number) => {
    return new Promise((resolve) => {
        setTimeout(resolve, delay)
    })
}

axios.defaults.baseURL = process.env.REACT_APP_API_URL;

axios.interceptors.request.use(config => {
    const token = store.commonStore.token;
    if(token) config.headers.Authorization = `Bearer ${token}`
    return config;
})

axios.interceptors.response.use(async response => {
    if(process.env.NODE_ENV === 'development') await sleep(100);
    const pagination = response.headers['pagination'];
    if(pagination) {
        response.data = new PaginatedResult(response.data, JSON.parse(pagination));
        return response as AxiosResponse<PaginatedResult<any>>
    }
    return response;
}, (error: AxiosError) => {
    const {data, status, config} = error.response!;
    switch(status) {
        case 400: 
            if(typeof data === 'string') {
                toast.error(data);
            }
            if(config.method === 'get' && data.errors.hasOwnProperty('id')){
                history.push('not-found');
            }
            if(data.errors) {
                const modalStateErrors = [];
                for (const key in data.errors){
                    if(data.errors[key]) {
                        modalStateErrors.push(data.errors[key])
                    }
                }

                throw modalStateErrors.flat();
            }
            // else {
            //     toast.error(data);
            // }
            break;
        case 401:
            toast.error('unauthorized!');
            break;
        case 404:
            history.push('not-found');
            break;
        case 500:
           store.commonStore.setServerError(data);
           history.push('server-error');
            break;
    }
    return Promise.reject(error);
})

const responseBody = <T>(reponse: AxiosResponse<T>) => reponse.data;

const requests = {
    get: <T>(url: string) => axios.get<T>(url).then(responseBody),
    post: <T>(url: string, body : {}) => axios.post<T>(url, body).then(responseBody),
    put: <T>(url: string, body: {}) => axios.put<T>(url, body).then(responseBody),
    del: <T>(url:string ) => axios.delete<T>(url).then(responseBody)
}

const Activities = {
    list: (params: URLSearchParams) => axios.get<PaginatedResult<Activity[]>>('activities', {params})
    .then(responseBody),
    details: (id: string) => requests.get<Activity>(`activities/${id}`),
    create: (activity: ActivityFormValues) => requests.post<void>('activities', activity),
    update: (activity: ActivityFormValues) => requests.put<void>(`activities/${activity.id}`, activity),
    delete: (id: string) => requests.del<void>(`/activities/${id}`),
    attend: (id: string) => requests.post<void>(`/activities/${id}/attend`, {})
}

const Account = {
    current: () => requests.get<User>('/account'),
    login: (user: UserFormValues ) => requests.post<User>('/account/login', user) ,
    register: (user: UserFormValues) => requests.post<User>('/account/register', user)
}

const Profiles = {
    get: (username: string) => requests.get<Profile>(`/profiles/${username}`),
    uploadPhoto: (file: Blob) => {
        let formData = new FormData();
        formData.append('File', file);
        return axios.post<Photo>('photos', formData, {
            headers: {'Content-type': 'multipart/form-data'}
        })
    },
    setMainPhoto: (id: string) => requests.post(`/photos/${id}/setMain`, {}),
    deletePhoto: (id: string) => requests.del(`/photos/${id}`),
    updateProfile: (profile: Partial<Profile>) => requests.put(`/profiles`, profile),
    updateFollowing: (username: string) => requests.post(`/follow/${username}`, {}),
    listFollowings: (username: string, predicate: string) =>
            requests.get<Profile[]>(`/follow/${username}?predicate=${predicate}`),
    listActivities: (username: string, predicate: string) => 
        requests.get<UserActivity[]>(`/profiles/${username}/activities?predicate=${predicate}`)
}

const agent = {
    Activities, Account, Profiles
}

export default agent;