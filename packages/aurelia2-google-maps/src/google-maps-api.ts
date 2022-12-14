import { DI } from '@aurelia/kernel';
import { IGoogleMapsConfiguration } from './configure';

export const IGoogleMapsAPI = DI.createInterface<IGoogleMapsAPI>('IGoogleMapsAPI', x => x.singleton(GoogleMapsAPI));
export interface IGoogleMapsAPI extends GoogleMapsAPI {}
export class GoogleMapsAPI {
    _scriptPromise: any = null;

    constructor(@IGoogleMapsConfiguration readonly config: IGoogleMapsConfiguration) {

    }

    getMapsInstance() {
        if (this._scriptPromise !== null) {
            return this._scriptPromise;
        }

        if ((<any>window).google === undefined || (<any>window).google.maps === undefined) {
            // google has not been defined yet
            let script = document.createElement('script');

            let params = [
                this.config.get('apiKey') ? `key=${this.config.get('apiKey')}&` : '',
                this.config.get('client') ? `client=${this.config.get('client')}` : '',
                this.config.get('apiLibraries') ? `libraries=${this.config.get('apiLibraries')}` : '',
                this.config.get('language') ? `language=${this.config.get('language')}` : '',
                this.config.get('region') ? `region=${this.config.get('region')}` : '',
                'callback=aureliaGoogleMapsCallback',
            ];

            script.type = 'text/javascript';
            script.async = true;
            script.defer = true;
            script.src = `${this.config.get('apiScript')}?${params.join('&')}`;
            document.body.appendChild(script);

            this._scriptPromise = new Promise((resolve, reject) => {
                (<any>window).aureliaGoogleMapsCallback = () => {
                    resolve(true);
                };
                script.onerror = error => {

                    reject(error);
                };
            });

            return this._scriptPromise;
        }

        if ((<any>window).google && (<any>window).google.maps) {
            // google has been defined already, so return an immediately resolved Promise that has scope
            this._scriptPromise = new Promise(resolve => { resolve(true); });

            return this._scriptPromise;
        }

        return false;
    }
}