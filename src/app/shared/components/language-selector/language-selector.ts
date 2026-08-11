import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Select } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { LanguageService } from '../../../core/services/language/language.service';
import { EventBusService } from '../../../core/services/event_bus/eventbus.service';
import { UserService } from '../../services/user.service';

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
  private userService = inject(UserService);
  private destroyRef = inject(DestroyRef);

  currentLang = this.detectInitialLang();
  get currentLangLabel(): string | undefined {
    return this.langs.find((l) => l.code === this.currentLang)?.label;
  }

  setLang(code: string): void {
    this.languageService.changeLanguage(code);
    this.eventBus.emit('changeLanguage', code);
    this.persist(code);
  }

  /**
   * Mirror the choice onto the user's profile.
   *
   * localStorage is enough for this browser, but an email is composed hours
   * later by a worker that has no browser to ask — `app_user.locale` is the only
   * source of truth it has. Best-effort on purpose: this selector also renders
   * on the unauthenticated pages, where the call would 401, and a failed save
   * must never block the language actually changing.
   */
  private persist(code: string): void {
    this.userService
      .updateUserInfo({ locale: code })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });
  }
  detectInitialLang(): string | null {
    return this.languageService.getCurrentLanguage();
  }
}
