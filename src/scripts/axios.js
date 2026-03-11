import axios from 'axios'

//axios.defaults.baseURL = '/api'
axios.defaults.baseURL = 'http://localhost:8000/api/'
axios.defaults.timeout = 10800000;
axios.defaults.withCredentials = false;
axios.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8;';

axios.defaults.headers.post['Access-Control-Allow-Origin'] = '*';
axios.interceptors.request.use(
    config => {
        return config;
    },
    error => {
        console.log("error");
        return Promise.reject(error);
    }
);
export default axios