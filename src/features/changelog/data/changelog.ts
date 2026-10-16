// Changelog shipped with the app, newest version first.
// Add one entry per release before bumping package.json. "en" is required,
// the other locales are optional and fall back to "en". "date" (YYYY-MM-DD)
// is optional and shown next to the version.
import type { ChangelogEntry } from "../lib/changelog";

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.1.36",
    changes: [
      {
        type: "new",
        text: {
          en: "Spanish translation.",
          ru: "Испанский язык интерфейса.",
          uk: "Іспанська мова інтерфейсу.",
          es: "Traducción al español.",
        },
      },
      {
        type: "new",
        text: {
          en: "Recent searches can be removed one at a time.",
          ru: "Недавние запросы можно удалять по одному.",
          uk: "Недавні запити можна видаляти по одному.",
          es: "Las búsquedas recientes se pueden borrar una a una.",
        },
      },
      {
        type: "new",
        text: {
          en: "What's new popup after each update, also available in Settings > About.",
          ru: "Окно «Что нового» после каждого обновления, также доступно в Настройки > О приложении.",
          uk: "Вікно «Що нового» після кожного оновлення, також доступне в Налаштування > Про застосунок.",
          es: "Ventana de novedades tras cada actualización, también disponible en Ajustes > Acerca de.",
        },
      },
      {
        type: "improved",
        text: {
          en: "The display stays awake while music is playing.",
          ru: "Экран не гаснет, пока играет музыка.",
          uk: "Екран не згасає, поки грає музика.",
          es: "La pantalla no se apaga mientras suena la música.",
        },
      },
      {
        type: "improved",
        text: {
          en: "Clearer messages when the Liner server is down.",
          ru: "Понятные сообщения, когда сервер Liner недоступен.",
          uk: "Зрозумілі повідомлення, коли сервер Liner недоступний.",
          es: "Mensajes más claros cuando el servidor de Liner no responde.",
        },
      },
      {
        type: "fixed",
        text: {
          en: "A broken cached track no longer reloads endlessly.",
          ru: "Повреждённый трек из кэша больше не перезагружается бесконечно.",
          uk: "Пошкоджений трек із кешу більше не перезавантажується безкінечно.",
          es: "Una pista en caché dañada ya no se recarga sin fin.",
        },
      },
      {
        type: "fixed",
        text: {
          en: "The window can be moved on Linux with Wayland.",
          ru: "Окно снова можно перемещать в Linux с Wayland.",
          uk: "Вікно знову можна переміщати в Linux з Wayland.",
          es: "La ventana se puede mover en Linux con Wayland.",
        },
      },
      {
        type: "fixed",
        text: {
          en: "Toggle switches no longer shrink next to long labels.",
          ru: "Переключатели больше не сжимаются рядом с длинными подписями.",
          uk: "Перемикачі більше не стискаються поруч із довгими підписами.",
          es: "Los interruptores ya no se encogen junto a textos largos.",
        },
      },
    ],
  },
];
