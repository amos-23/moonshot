// Where people can reach support outside the chat. Shown in the Help panel on every page.
export const SUPPORT_EMAIL = "amos.feranmi@gmail.com";
export const SUPPORT_WHATSAPP = "2348153260295"; // international format, no "+"
export const SUPPORT_WHATSAPP_LABEL = "+234 815 326 0295";

export const whatsappLink = (text: string) => `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(text)}`;
export const mailLink = (subject: string, body: string) => `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
