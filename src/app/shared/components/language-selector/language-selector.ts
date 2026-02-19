import { Component, inject } from '@angular/core';
import { Select } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../core/services/language/language.service';
import { EventBusService } from '../../../core/services/event_bus/eventbus.service';

@Component({
  selector: 'app-language-selector',
  imports: [Select, FormsModule, TranslatePipe],
  templateUrl: './language-selector.html',
  styleUrl: './language-selector.css',
  standalone: true,
})
export class LanguageSelector {
  langs = [
    { label: 'Français', code: 'fr' },
    { label: 'English', code: 'en' },
    { label: 'Nederlands', code: 'nl' },
    { label: 'Deutsch', code: 'de' },
  ];
  private languageService = inject(LanguageService);
  private eventBus = inject(EventBusService);

  currentLang = this.detectInitialLang();
  get currentLangLabel() {
    return this.langs.find((l) => l.code === this.currentLang)?.label;
  }

  setLang(code: string) {
    this.languageService.changeLanguage(code);
    this.eventBus.emit('changeLanguage', code);
  }
  detectInitialLang() {
    return this.languageService.getCurrentLanguage();
  }
}
