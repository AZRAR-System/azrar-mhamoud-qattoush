import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

void i18n.use(initReactI18next).init({
  lng: 'ar',
  fallbackLng: 'ar',
  resources: {
    ar: { translation: {} },
    en: { translation: {} },
  },
  interpolation: { escapeValue: false },
});

export default i18n;
