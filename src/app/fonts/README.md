# Fuentes autoalojadas

Ref: prompts-agentes-estilo-v2.md §4 (fuentes autoalojadas) y VS-0; decisiones-delegadas-web-fase7.md DF7-04 y DF7-05.

Nunca se cargan desde Google Fonts ni desde otro CDN: los archivos de esta carpeta los sirve la propia aplicación
(`next/font/local` en `src/app/fonts.ts`).

| Archivo | Familia | Ejes que se conservan | Origen (repositorio oficial) | Licencia |
|---|---|---|---|---|
| `bricolage-grotesque-latin.woff2` | Bricolage Grotesque | `wght` 600–800, `opsz` 12–96 (`wdth` fijado en 100) | `ateliertriay/bricolage` @ `84745e5b96261ae5f8c6c856e262fe78d1d6efdd`, `fonts/variable/BricolageGrotesque[opsz,wdth,wght].ttf` (sha256 `413e7357809ddd12fd80a96a8a396de0e401638d4acd3cb3e37532f0472ac682`) | `OFL-BricolageGrotesque.txt` (SIL OFL 1.1, sin Reserved Font Name) |
| `jetbrains-mono-latin.woff2` | JetBrains Mono | `wght` 500–600 | `JetBrains/JetBrainsMono` @ `19371302b95d218af43299bce79ddbddd0bc364d`, `fonts/variable/JetBrainsMono[wght].ttf` (sha256 `3cfafa86e28b87184d592fef82846e8c10cb48653c62efcda34f082da225ec34`) | `OFL-JetBrainsMono.txt` (SIL OFL 1.1, sin Reserved Font Name) |

## Cómo se generaron (reproducible)

Con `fonttools` 4.67.0 y `brotli` en un entorno virtual aparte (no son dependencias del repositorio):

```sh
U="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2190-2193,U+2212,U+2215,U+FEFF,U+FFFD"
fonttools varLib.instancer BricolageGrotesque[opsz,wdth,wght].ttf wdth=100 wght=600:800 opsz=12:96 -o b.ttf
fonttools varLib.instancer JetBrainsMono[wght].ttf wght=500:600 -o j.ttf
pyftsubset b.ttf --unicodes="$U" --layout-features='kern,liga,calt,ccmp,locl,mark,mkmk' --flavor=woff2 --output-file=bricolage-grotesque-latin.woff2
pyftsubset j.ttf --unicodes="$U" --layout-features='kern,ccmp,locl,mark,mkmk' --flavor=woff2 --output-file=jetbrains-mono-latin.woff2
```

El subconjunto es latino básico + Latin-1 (incluye `á é í ó ú ñ ü ¿ ¡`), puntuación general, `€` y flechas.
Las dos licencias OFL no declaran Reserved Font Name, así que el subconjunto puede conservar el nombre de la familia.
