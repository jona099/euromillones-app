# Trébol · Peña Euromillones

App Angular 19 + Supabase para que Jona, Sergio y Fer registren sus jugadas semanales
(turno rotativo), los premios y el balance invertido vs ganado.

## 1. Supabase (una sola vez)

1. Crea un proyecto gratuito en https://supabase.com (región: Europe West).
2. **Authentication › Sign In / Providers › Email**: desactiva *Allow new users to sign up*.
3. **Authentication › Users › Add user › Create new user** (marca *Auto Confirm User*):
   crea a Jona, Sergio y Fer con su email y contraseña.
4. **SQL Editor**: pega y ejecuta `supabase/schema.sql`.
5. Copia los UUID de los 3 usuarios (columna *UID* en Users), descomenta el bloque final
   de `schema.sql`, pon los UUID y un **lunes** como `rotation_start` (la semana en la que
   empieza Jona) y ejecútalo.
6. **Project Settings › API**: copia *Project URL* y la clave *anon public* en
   `src/environments/environment.ts` y `environment.prod.ts`.

> La clave `anon` es pública por diseño: los datos los protege RLS + que solo existan 3 usuarios.

## 2. Local

```powershell
cd C:\ProyectosAI\euromillones-app
npm install
npm start          # http://localhost:4200
```

## 3. GitHub Pages

```powershell
git init
git add .
git commit -m "Trébol: peña Euromillones"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/euromillones-app.git
git push -u origin main
```

En GitHub: **Settings › Pages › Source: GitHub Actions**. El workflow
`.github/workflows/deploy.yml` compila y publica en cada push a `main`.
URL final: `https://TU_USUARIO.github.io/euromillones-app/`
