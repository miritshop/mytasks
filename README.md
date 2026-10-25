# היום שלי

מנהל משימות בעברית (RTL) לאמא עם ADHD: נקי, שמח, גמיש.

- **האתר:** https://exquisite-sorbet-766afd.netlify.app
- **הקוד:** https://github.com/miritshop/mytasks
- **טכנולוגיה:** React + Vite, Supabase (התחברות, PostgreSQL, אחסון תמונות), אירוח ב-Netlify.

## מה יש בו

מסך "היום" (מיקוד), טבלה עם עמודות גמישות (טקסט, בחירה, תאריך, מספר, תיבת סימון, תגיות, עדיפות), גרף של משימות מקושרות, תת-טבלאות, קטגוריות עם קינון אינסופי והצעת פיצול, סינון על פני כל הרשימות, אייקונים אוטומטיים, תמונות במשימות, וחשבונות עם סנכרון בין מכשירים.
פירוט מלא: [SPEC.md](SPEC.md).

## הרצה מקומית

```bash
npm install
cp .env.example .env     # ואז למלא את שני הערכים (ראו למטה)
npm run dev              # http://localhost:5173 (וגם בכתובת הרשת לגישה מהטלפון)
npm run build            # בדיקה שהכל מתקמפל
```

## הקמה מאפס

### 1. Supabase (פעם אחת)
1. ב-[supabase.com](https://supabase.com) ליצור פרויקט חדש (אזור קרוב, למשל Frankfurt). לשמור את סיסמת בסיס הנתונים במקום בטוח ולא לשתף אותה.
2. **SQL Editor** ← New query ← להדביק את כל [supabase/schema.sql](supabase/schema.sql) ← Run. הקובץ בטוח להרצה חוזרת. הוא יוצר את הטבלאות, כללי ההרשאה (RLS) ואת תיקיית התמונות הפרטית `task-images`.
3. **Authentication** ← Sign In / Providers ← Email: להחליט אם לדרוש אישור אימייל. בתקופת ניסוי אפשר לכבות את "Confirm email", ולפני פתיחה רחבה להגביל הרשמה.
4. **Project Settings** ← **API Keys** ← לשונית Legacy: להעתיק את **Project URL** ואת מפתח **anon**.
   **לעולם** לא להשתמש ב-`service_role` / secret key באתר או בגיט.

### 2. קובץ `.env` (מקומי, לא עולה לגיט)
```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

### 3. פרסום ב-Netlify
1. ב-[netlify.com](https://www.netlify.com): Sign up עם GitHub ← Add new site ← Import an existing project ← הריפו `mytasks`.
2. ההגדרות נקראות מ-`netlify.toml` (פקודה `npm run build`, תיקייה `dist`).
3. לפני Deploy, להוסיף משתני סביבה: `VITE_SUPABASE_URL` ו-`VITE_SUPABASE_ANON_KEY` (אותם ערכים כמו ב-`.env`).
4. אחרי שנוצרה כתובת: ב-Supabase ← **Authentication** ← **URL Configuration**: ב-Site URL להזין את כתובת האתר, וב-Redirect URLs להוסיף `<הכתובת>/**` (ואפשר גם `http://localhost:5173/**` לפיתוח).

## סביבות: בדיקה ואתר חי

שתי סביבות נפרדות, כדי לבדוק שינויים בלי לפגוע בנתונים האמיתיים:

| | בדיקה | אתר חי |
|---|---|---|
| הרצה | `npm run dev` / `localhost` | Netlify (מ-`main`) |
| בסיס נתונים | פרויקט Supabase נפרד | הפרויקט הראשי |
| מפתחות | `.env.development.local` | `.env` מקומי + משתני סביבה ב-Netlify |

הקמת סביבת בדיקה: ליצור פרויקט Supabase שני, להריץ בו את `supabase/schema.sql`, לכבות שם **Confirm email** (כדי להירשם עם אימייל פיקטיבי), ולהכניס את הכתובת ומפתח ה-anon שלו ל-`.env.development.local`.
**זרימה:** שינוי בענף נפרד ← בדיקה ב-`localhost` ← אישור ← הרצת שינוי הסכמה בפרויקט החי ← מיזוג ל-`main` (מתפרסם אוטומטית).

## עבודה שוטפת

```
שינוי בקוד ← npm run build ← בדיקה בדפדפן ← git commit ← git push origin main
```
כל push ל-`main` מפרסם אוטומטית גרסה חדשה ב-Netlify. שינוי במבנה בסיס הנתונים דורש גם להריץ ב-SQL Editor את השינוי ב-`schema.sql`.

## אבטחה: רשימת בדיקה

- [ ] `.env` לא בגיט (נמצא ב-`.gitignore`).
- [ ] באתר ובגיט אין `service_role` / secret key, רק מפתח `anon`.
- [ ] לכל טבלה ב-Supabase יש Row Level Security ו-policy לפי `owner = auth.uid()`.
- [ ] תיקיית התמונות `task-images` פרטית (לא Public).
- [ ] לפני פתיחה למשתמשים רבים: להגביל הרשמה ולבדוק מגבלות מיילי האימות.

## תקלות ידועות ופתרונות

| תופעה | סיבה ופתרון |
|---|---|
| קישור אימות או איפוס סיסמה מחזיר ל-`localhost` | לא הוגדרה כתובת האתר ב-Supabase (Authentication ← URL Configuration) |
| כל הנתונים הוכפלו אחרי הרשמה | שתי לשוניות מילאו חשבון חדש יחד. תוקן ב-`claimInit`. לניקוי: למחוק את שורות החשבון (`lists` ו-`user_settings`) ב-SQL ולהיכנס מחדש בלשונית אחת |
| שינויים לא נשמרים והתמונה נכשלת ב-foreign key | באג שמירה שתוקן (`flush`). אם חוזר: לבדוק את הסטטוס בתחתית הסרגל ואת הודעת השגיאה |
| ההעלאה נכשלת | לבדוק שקיימת תיקיית `task-images` ושהוגדרו policies ל-`storage.objects` (החלק האחרון ב-`schema.sql`) |
| הדבקה מהלוח לא עובדת | נדרש חיבור מאובטח (https) או הרשאת לוח. באתר המפורסם זה עובד |
| אימוג'י מוצג כריבוע ריק | אימוג'י חדש מאוד ש-Windows 10 לא מכיר. מחליפים באחר |

## מסמכים

| קובץ | תפקיד |
|---|---|
| [SPEC.md](SPEC.md) | האיפיון המלא, ההחלטות והכללים. מעלים אותו ל-Claude כדי לבנות מחדש |
| [CLAUDE.md](CLAUDE.md) | הנחיות עבודה ומלכודות ל-Claude Code בתיקייה הזו |
| `.claude/skills/mypa/SKILL.md` | skill שמרכז את אופן העבודה על הפרויקט |
| [supabase/schema.sql](supabase/schema.sql) | הסכמה והאבטחה של בסיס הנתונים |
