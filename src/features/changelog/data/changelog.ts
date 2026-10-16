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
          en: "Report wrong lyrics: right-click a lyrics line in the side panel or in fullscreen, then choose \"Report wrong lyrics\" or \"Report out of sync\". The moment of the song is saved with the line, and \"View lyrics reports\" in the same menu lists your reports and replays that moment.",
          ru: "Жалобы на текст: нажмите правой кнопкой на строку текста в боковой панели или в полноэкранном режиме и выберите «Сообщить о неверном тексте» или «Сообщить о рассинхроне». Вместе со строкой сохраняется момент песни, а пункт «Жалобы на текст» в том же меню показывает ваши жалобы и проигрывает этот момент.",
          uk: "Скарги на текст: натисніть правою кнопкою на рядок тексту в бічній панелі або в повноекранному режимі й виберіть «Повідомити про неправильний текст» або «Повідомити про розсинхрон». Разом із рядком зберігається момент пісні, а пункт «Скарги на текст» у тому ж меню показує ваші скарги й відтворює цей момент.",
          es: "Reportar letras incorrectas: haz clic derecho en una línea de la letra en el panel lateral o en pantalla completa y elige «Reportar letra incorrecta» o «Reportar desincronización». Se guarda el momento de la canción con la línea, y «Ver reportes de letras» en el mismo menú muestra tus reportes y reproduce ese momento.",
        },
      },
      {
        type: "new",
        text: {
          en: "Offline mode: when Liner's servers are down or you have no connection, the \"Downloaded music\" button on the error screen opens the tracks already saved on this computer, and they play without the server.",
          ru: "Офлайн-режим: когда серверы Liner недоступны или нет интернета, кнопка «Скачанная музыка» на экране ошибки открывает треки, уже сохранённые на компьютере, и они играют без сервера.",
          uk: "Офлайн-режим: коли сервери Liner недоступні або немає інтернету, кнопка «Завантажена музика» на екрані помилки відкриває треки, уже збережені на комп'ютері, і вони грають без сервера.",
          es: "Modo sin conexión: cuando los servidores de Liner fallan o no tienes conexión, el botón «Música descargada» de la pantalla de error abre las pistas ya guardadas en este ordenador, que se reproducen sin el servidor.",
        },
      },
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
          en: "The overlay now also shows when you switch away from Liner with Alt+Tab.",
          ru: "Оверлей теперь появляется и при переключении с Liner через Alt+Tab.",
          uk: "Оверлей тепер з'являється і під час перемикання з Liner через Alt+Tab.",
          es: "El overlay ahora también aparece al salir de Liner con Alt+Tab.",
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
