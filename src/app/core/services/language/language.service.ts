import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root',
})
export class LanguageService {

  constructor(private translate: TranslateService) {
    console.log('LanguageService', translate);
    this.init();
  }

  setTranslate(lang:string){
    this.translate.setFallbackLang(lang);
    this.translate.use(lang);
  }

  init() {
    this.setlanguage();
  }

  getCurrentLanguage():string |null{
    return localStorage.getItem('language');
  }

  setlanguage(){
    console.log("SET LANGUAGE")
    const savedLang = localStorage.getItem('language')
    if(savedLang){
      this.setTranslate(savedLang);
    }else{
      const getLangLocal = this.getUsersLocale();
      if(getLangLocal){
        this.changeLanguage(getLangLocal);
      }else{
        this.changeLanguage('fr');
      }
    }
    console.log("GET CURRENT LANGUAGE");
    console.log(this.getCurrentLanguage())
  }

  getUsersLocale(): string | undefined {
    if (typeof window === 'undefined' || typeof window.navigator === 'undefined') {
      return undefined;
    }
    const wn = window.navigator as any;
    let lang = wn.languages ? wn.languages[0] : undefined;
    if (lang) {
      lang = lang || wn.language || wn.browserLanguage || wn.userLanguage;
      return lang;
    }
    return undefined;
  }

  changeLanguage(lang: string) {
    localStorage.setItem('language', lang);
    this.setTranslate(lang);
  }
}
