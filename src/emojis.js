export const EMOJI_SETS = [
  ['🏠', 'בית', '🏡🏠🛋️🛏️🚿🛁🧺🧹🧼🧽🍽️🥣🍳🔑🕯️💡🔧🔨🧰🚪'],
  ['💖', 'אני', '🌸💆‍♀️🧘‍♀️💅💄💋👗👠👜🛍️🌿🛀☕🍵🧖‍♀️🌷🌺🌼🦋✨🌈🎀💎👑💖❤️🧡💛💚💙💜🤍'],
  ['🍎', 'אוכל', '🍎🍌🍇🍓🍉🍑🥑🥕🥦🍅🥐🍞🧀🥚🍕🍔🍝🥗🍰🎂🍪🍫🍦☕🧃🥤🍷'],
  ['💼', 'עבודה', '💼📁📅📝📞💻📧📊📈🧾💳💰🏦📦🗂️✏️📌📎🖨️🔔⏰⏳'],
  ['🧸', 'ילדים', '🧸🎒📚✏️🎨🧩🎈🎁🎂🎉🚸🍼👶👧🧒⚽🚲🎠🎮'],
  ['💪', 'בריאות', '💪🏃‍♀️🧘‍♀️🚴‍♀️🏊‍♀️🩺💊💉🦷😴🧠🥗💧🌿🛌'],
  ['✈️', 'מסביב', '✈️🚗🚌🚆🚕🧳🗺️🏖️⛺🌍🏔️🎡🎬🎵🎤🎧📷🎟️🛒🏪'],
  ['🐶', 'חיות וטבע', '🐶🐱🐰🐹🐠🐦🐴🦋🐝🌳🌻🌹🍀🌞🌙⭐☁️🌧️🔥❄️'],
  ['😊', 'פרצופים', '😊😄😍🥰😎🤩🥳😌🤗😴🤔😅😇🙃😉🤪'],
];
export const ICON_CHOICES = EMOJI_SETS.flatMap(([, , s]) => [...new Intl.Segmenter('he', { granularity: 'grapheme' }).segment(s)].map((x) => x.segment));
// First emoji of any string (handles multi-part emoji); '' if none
export const firstEmoji = (str = '') => {
  const seg = [...new Intl.Segmenter('he', { granularity: 'grapheme' }).segment(str.trim())].map((x) => x.segment);
  return seg.find((g) => /\p{Extended_Pictographic}/u.test(g)) || '';
};
