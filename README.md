# Journal de prompts

Application web (PWA) pour saisir et dater ses prompts IA pour l'annexe du PPI ou du PPC.

- `src/` : le site (HTML, CSS, JavaScript, service worker).
- `npm run build` : copie le site dans `dist/`.
- `.github/workflows/pages.yml` : publie automatiquement `dist/` sur GitHub Pages à chaque envoi sur `main`.

## Publier

1. Créez un dépôt vide sur GitHub (par exemple `se-formation/journal-prompts-v2`).
2. Dans ce dossier :
   ```
   git remote add origin https://github.com/se-formation/journal-prompts-v2.git
   git push -u origin main
   ```
3. Sur GitHub : Settings › Pages › Source : « GitHub Actions ».

Le site sera en ligne à l'adresse `https://se-formation.github.io/journal-prompts-v2/`.
