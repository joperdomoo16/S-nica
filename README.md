# 🎙️ Sónica — Aplicación Móvil (Android & iOS)

Plataforma móvil de nueva generación para **podcasts, audioseries inmersivas y relatos sonoros**, diseñada y optimizada con arquitectura **Mobile-First / Touch-First** para smartphones **Android** y **Apple iOS**.

> **Nota**: Este proyecto es la migración 1:1 del código original en React + TypeScript + Framer Motion (`sónica/src/`) a **Vanilla JavaScript (ES Modules)** sin dependencias de framework, manteniendo exactitud visual y funcional al 100%.

---

## 📱 Visión General del Proyecto

**Sónica** es una experiencia móvil interactiva de audio de alta fidelidad desarrollada con estándares web nativos modernos (HTML5, Tailwind CSS v4, JavaScript ES Modules y Firebase v11). La interfaz ha sido concebida específicamente para pantallas táctiles de dispositivos móviles, ofreciendo una experiencia idéntica a una aplicación nativa:

- **Diseño Táctil y Gestual**: Navegación por barra inferior (*Bottom Navigation Bar*), soporte de gestos táctiles, prevención de rebotes innecesarios (`-webkit-touch-callout: none`) y cálculo dinámico de altura para barras de estado móviles (`100dvh`).
- **Reproductor de Audio Persistente**: *Mini-Player* flotante inferior que no interrumpe la navegación mientras el usuario explora el catálogo, expandible a un reproductor a pantalla completa inmersivo con visualizador de ondas acústicas táctil.
- **Doble Experiencia Integrada**: Entorno completo para el **Oyente** (descubrimiento, streaming, biblioteca, suscripciones) y **Estudio del Creador** (subida de capítulos, métricas, finanzas y moderación).
- **Estética Cyber-Dark Premium**: Paleta oscura profunda (`#050506`), paneles con desenfoque de cristal (*glassmorphism*), acentos lumínicos neón cian (`#00e5ff`) y tipografías modernas (*Plus Jakarta Sans* & *Inter*).

---

## 🚀 Tecnologías Principales

| Área | Tecnología | Descripción |
| :--- | :--- | :--- |
| **Frontend Core** | **HTML5 & Vanilla JavaScript (ESM)** | Código modular, reactivo, sin dependencias pesadas ni tiempos de inicio lentos en móviles. |
| **Estilos y UI** | **Tailwind CSS v4** | Utilidades modernas con sistema `@theme`, variables HSL y soporte de Safe Area Insets. |
| **Navegación Móvil** | **Client-side HashRouter** | Transiciones instantáneas entre pantallas sin recargas de página (`#/`, `#/explore`, `#/player/:id`). |
| **Iconografía** | **Lucide Icons** | Iconos vectoriales SVG nítidos en pantallas Retina y AMOLED de alta densidad. |
| **Autenticación** | **Firebase Auth v11** | Inicio de sesión con Google One-Tap, Correo/Contraseña y persistencia local de sesión. |
| **Base de Datos** | **Cloud Firestore** | Base de datos reactiva en la nube (ID: `ai-studio-8496b64b-dc71-4766-8cd3-b0d2b0727d19`). |
| **Almacenamiento** | **Firebase Storage** | Almacenamiento seguro de archivos de audio (MP3/WAV) y carátulas en alta resolución (1024×1024). |
| **Herramienta de Build** | **Vite v6** | Entorno de desarrollo ultra rápido con Hot Module Replacement (HMR) y bundler optimizado. |

---

## 🌟 Funcionalidades de la App Móvil

### 1. 🎧 Experiencia del Oyente (Consumer)

- **Inicio (Home)**:
  - Carrusel de *"Continuar escuchando"* con barra de progreso directamente sobre el artwork.
  - Sección *"Tendencias"* con conteo de reproducciones en tiempo real.
  - *"Podcasts Destacados"* con etiquetas dinámicas (`ORIGINAL`, `ESTRENO`, `DESTACADO`).
  - *"Creadores en Tendencia"* con anillo de gradiente interactivo.
  - Cuadrícula adaptativa *"Recomendado para ti"*.
- **Explorador y Búsqueda Reactiva**:
  - Buscador en vivo por títulos de series, capítulos y nombres de creadores.
  - Catálogo interactivo de 15 categorías sonoras con portadas temáticas dedicadas.
- **Detalle de Serie**:
  - Encabezado con póster vertical inmersivo de 480px y botones flotantes (*Volver*, *Guardar en Biblioteca*, *Compartir*).
  - Tarjeta de información con badge de verificación, sinopsis completa y listado cronológico de episodios con duraciones y fechas.
- **Suscripciones y Novedades**:
  - Acceso directo a podcasts suscritos, autores favoritos seguidos y feed cronológico de episodios publicados en los últimos 7 días.
- **Perfil de Usuario**:
  - Sonica ID único, selector de 27 avatares oficiales o subida de foto de perfil.
  - Configuración de calidad de streaming, vaciado de caché local y planes de suscripción Premium.

---

### 2. 🎵 Motor de Audio y Reproductor (Detalle Técnico Completo)

El sistema de reproducción se compone de dos capas independientes que trabajan sincronizadas:

#### 2.1. Motor de Audio (`src/js/player.js`) — Capa Persistente Global

El motor mantiene un singleton `HTMLAudioElement` que sobrevive entre cambios de ruta, permitiendo escuchar audio de forma ininterrumpida mientras el usuario navega por cualquier pantalla de la app.

| Característica | Detalle |
| :--- | :--- |
| **Singleton de Audio** | Un único elemento `new Audio()` inicializado en `initPlayer()` persiste durante toda la sesión. |
| **Event Listeners Nativos** | `timeupdate`, `loadedmetadata`, `play`, `pause`, `ended` — sincronizan el estado global y la UI del mini-player en tiempo real. |
| **Sistema de Suscripciones** | Patrón pub-sub con `onPlayerUpdate(callback)` — cada vista que necesita datos del reproductor se suscribe al flujo de actualizaciones (currentTime, duration, isPlaying, currentEpisode, currentSeries). |
| **Historial de Escucha (Sync Firestore)** | Cada 5 segundos durante la reproducción activa (`setInterval`), el progreso se sincroniza con `users/{uid}.listeningHistory` en Firestore, limitado a los 10 episodios más recientes. Los episodios completados al ≥95% son excluidos. |
| **Registro de Vistas (view_logs)** | Al iniciar la reproducción de un nuevo episodio, se crea un documento en la colección `view_logs` con campos: `episodeId`, `seriesId`, `creatorId`, `userId`, `category` y `timestamp`. Se previene el registro duplicado con un flag `viewLoggedFor`. |
| **API Pública Exportada** | `playEpisode(episode, series)`, `togglePlay()`, `seek(seconds)`, `closeMiniPlayer()`, `getPlayerState()`, `onPlayerUpdate(cb)`. |

#### 2.2. Mini-Player Flotante (Shell HTML — `index.html`)

Elemento fijo (`position: fixed`) que flota entre la barra de navegación inferior y el contenido principal, visible siempre que haya un episodio cargado excepto en la pantalla de reproductor completo:

- **Diseño Visual**: Fondo `#1a1c23/95` con `backdrop-blur-3xl`, bordes redondeados `2rem`, sombra profunda y ring sutil `ring-1 ring-white/5`.
- **Información en Miniatura**: Artwork `48×48px` con `rounded-2xl`, título del episodio en `font-black text-[13px] uppercase italic`, nombre de serie en `text-primary text-[10px] tracking-widest`.
- **Barra de Progreso Integrada**: Delgada línea `h-0.5` que refleja `(currentTime / duration) * 100%` con gradiente cian y sombra `shadow-[0_0_8px_rgba(0,229,255,0.5)]`.
- **Controles**: Botón Play/Pause con iconos Lucide SVG intercambiados dinámicamente, y botón de cierre `X`.
- **Tap para Abrir**: Al pulsar el artwork o título, navega automáticamente a `#/player/{episodeId}` (reproductor completo).
- **Visibilidad Inteligente**: Se oculta automáticamente vía `hashchange` cuando la ruta actual es `/player/` para evitar duplicar controles.

#### 2.3. Reproductor a Pantalla Completa (`src/js/views/player.js`)

Vista inmersiva que ocupa el 100% de la pantalla con los siguientes componentes detallados:

| Elemento Visual | Especificación Técnica |
| :--- | :--- |
| **Header Flotante** | `fixed top-0`, botón circular de volver (ArrowLeft, `strokeWidth: 3`), etiqueta "Reproduciendo" centrada en `text-[10px] font-black text-primary/40 uppercase tracking-[0.3em]`. |
| **Artwork Principal** | `w-64 h-64` (escala hasta `w-72 h-72` en `sm:`), `max-w-[80vw]`, bordes `rounded-[2rem]/[3rem]`, sombra extrema `shadow-[0_40px_80px_rgba(0,0,0,0.8)]`, efecto hover scale `group-hover:scale-110` con gradiente de transición superpuesto. |
| **Tipografía de Título** | Nombre de serie en `text-3xl font-black font-headline tracking-tighter uppercase italic leading-none`, título del episodio debajo en `text-primary text-xs font-black uppercase tracking-[0.2em]`. |
| **Pill de Categoría** | Badge animado con punto pulsante `animate-pulse` en cian + nombre de categoría en `text-[9px] font-black uppercase tracking-widest`, sobre fondo `bg-white/5 border border-white/5`. |
| **Visualizador de Ondas Acústicas** | **40 barras verticales** de frecuencia (`w-[4.5px] rounded-full`) con alturas pseudoaleatorias generadas con `Math.random()`. Las barras completadas se iluminan con `bg-primary shadow-[0_0_15px_rgba(0,229,255,0.8)]`, las pendientes quedan en `bg-white/10`. Cuando no se reproduce, las barras se comprimen a `Math.max(15, height / 2.5)%`. Soporte completo de **scrubbing táctil** con `touchstart`, `touchmove`, `touchend` y cálculo proporcional de posición. |
| **Indicadores de Tiempo** | Tiempo actual en `text-[10px] font-black text-primary tracking-widest` (izquierda), duración total en `text-white/20` (derecha). |
| **Controles de Reproducción** | Layout flex centrado con 5 botones: **-15s** (RotateCcw con badge "15"), **Anterior** (SkipBack), **Play/Pause central** (circle `w-20 h-20 rounded-full bg-primary` con sombra neón `shadow-[0_0_30px_rgba(0,229,255,0.4)]`), **Siguiente** (SkipForward), **+15s** (RotateCw con badge "15"). |
| **Botones de Acción** | Grid 2 columnas: **COMENTAR** y **COMPARTIR**, con fondo `bg-white/5 border border-white/10`, iconos `MessageSquare` y `Share2`, tipografía `font-black text-xs uppercase tracking-widest`. |
| **Preview de Reseñas** | Tarjeta con la reseña más reciente: avatar del usuario, nombre, estrellas de calificación (5 estrellas, `Star` fill/no-fill) y contenido en itálica. Si no hay reseñas: placeholder `"Sin reseñas aún"` con borde dashed. |
| **Modal de Calificación** | Overlay `bg-black/90 backdrop-blur-md z-[100]`, panel centrado `bg-[#14161d] rounded-[3rem] p-10 border border-white/10`. Título "Tu Opinión", selector de 5 estrellas interactivas (`size: 44`), textarea `h-40 bg-black/40 rounded-[2rem]`, botones "Cancelar" y "Publicar" (este último con `primary-gradient` y estado de carga con spinner). Al publicar: crea documento en `comments` y actualiza `ratingSum`/`ratingCount` de la serie en Firestore. |

---

### 3. 🎙️ Panel del Creador — Creator Studio (Detalle Visual y Funcional Completo)

El portal del creador es el centro de gestión completa para podcasters y narradores que producen contenido en Sónica. Se accede desde la barra de navegación inferior cuando el modo "Creador" está activo.

#### 3.1. Dashboard Principal (`src/js/views/creator.js`)

**Encabezado visual:**
- Subtítulo `GESTIÓN DE CONTENIDO` en `text-[10px] font-black text-cyan-400 uppercase tracking-[0.4em]`.
- Título principal `Panel del\nCreador` en `text-[35px] font-black font-headline tracking-tighter uppercase italic leading-[32.6px]`, distribuido en dos líneas con `<br/>`.

**Botón "Crear nueva serie":**
- Botón de ancho completo (`w-full py-5`) con gradiente horizontal `bg-gradient-to-r from-[#00A3FF] to-[#00E5FF]`.
- Bordes ultra redondeados `rounded-[2rem]`, texto oscuro `text-surface-dim`, icono `Plus` con `strokeWidth: 4` dentro de un círculo semi-transparente `bg-surface-dim/20`.
- Efecto de brillo difuso (`absolute inset-0 bg-primary/20 blur-xl`) que aparece al hover.
- Escala táctil reactiva `active:scale-[0.98]`.
- Al pulsar: navega a `#/creator/new-series`.

**Listado de Series Creadas:**
- Header de sección: `"Series creadas"` en `text-2xl font-black font-headline tracking-tighter uppercase italic` + botón de filtro con icono `Filter`.
- Cada serie se renderiza como una **tarjeta independiente** con los siguientes elementos detallados:

| Elemento de Tarjeta | Detalle Visual y Funcional |
| :--- | :--- |
| **Contenedor** | `bg-surface-container-high/20 backdrop-blur-xl rounded-[2.5rem] p-6 border border-white/5 shadow-xl` con overflow hidden. |
| **Selector de Idioma (Globo)** | Botón con icono `Globe` (`size: 18`) posicionado en `absolute top-4 right-4 z-30`, sobre fondo `bg-black/60 backdrop-blur-md rounded-2xl`. Al pulsar: despliega un menú dropdown con opciones de idioma (Español, Inglés, Portugués, Francés, Alemán, Italiano). Si la serie no tiene traducción en el idioma seleccionado, muestra un CTA de pantalla completa con botón `Plus` animado y texto localizado en el idioma destino (ej. "Add series in English", "Adicionar série em Português"), que al pulsar crea un borrador de traducción en Firestore con `originalSeriesId` vinculado. |
| **Thumbnail** | `aspect-video rounded-[2.2rem]` con overlay negro sutil `bg-black/10`. Fallback a `/Categorias/Ciencia Ficcion.png`. |
| **Badges de Estado** | Fila horizontal con dos pills: (1) Categoría en `bg-[#1A3A4A] text-primary text-[10px] font-black rounded-xl uppercase tracking-widest` y (2) Estado con colores semánticos: `publicado` → verde (`bg-green-500/10 text-green-500`), `in_review` → amarillo (`bg-yellow-500/10 text-yellow-500`), `rejected` → rojo (`bg-red-500/10 text-red-500`), `draft` → gris (`bg-gray-500/10 text-gray-400`). |
| **Título de la Serie** | `text-[25px] font-black font-headline leading-none uppercase tracking-tight`. |
| **Descripción** | `text-sm text-on-surface-variant font-medium opacity-60 line-clamp-2`. |
| **Botón ADMINISTRAR** | Solo habilitado cuando `status === 'publicado'`. Estilo activo: `bg-white/5 hover:bg-white/10 text-primary shadow-lg shadow-primary/5 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em]` con icono `List` (`strokeWidth: 3`). Al pulsar: navega a `#/creator/upload/{seriesId}` para gestionar episodios. |
| **Botón ESPERANDO APROBACIÓN** | Reemplaza a ADMINISTRAR cuando el estado NO es `publicado`. Estilo deshabilitado: `bg-white/[0.02] text-white/10 cursor-not-allowed border border-white/5` con icono `Lock` (`strokeWidth: 3, text-white/20`). |
| **Botón Eliminar (Papelera)** | `w-16 bg-red-500/10 hover:bg-red-500/20 py-5 rounded-[1.5rem] text-red-500 border border-red-500/10` con icono `Trash2`. Abre el modal de confirmación. |
| **Botón Editar (Lápiz)** | Visible solo cuando `status` es `draft`, `rejected` o `in_review`. `w-16 bg-white/5 hover:bg-white/10 py-5 rounded-[1.5rem] text-primary border border-white/5` con icono `Edit3`. Navega a `#/creator/edit/{seriesId}`. |

**Modal de Confirmación de Eliminación:**
- Overlay: `fixed inset-0 bg-black/80 backdrop-blur-md z-[100]`.
- Panel centrado: `max-w-sm bg-surface-container-highest rounded-[3rem] p-8 border border-white/5 shadow-2xl`.
- Barra roja superior: `absolute top-0 w-full h-1 bg-red-500/50`.
- Ícono central: `w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20` con icono `Trash2` (`size: 28`).
- Título: `"¿Eliminar Serie?"` en `text-2xl font-black font-headline uppercase italic`.
- Descripción: Nombre de la serie en negrita blanca, aviso de eliminación permanente incluyendo todos los episodios asociados.
- Acción destructiva: Usa `writeBatch(db)` para eliminar atómicamente el documento de serie y todos los episodios asociados (query por `seriesId` y `creatorId`).
- Botones: "Eliminar permanentemente" (`bg-red-500 text-white font-black uppercase rounded-full shadow-lg shadow-red-500/20`, spinner de carga durante la operación) y "Cancelar" (`bg-white/5 text-white/40`).

#### 3.2. Crear Nueva Serie (`src/js/views/new-series.js`)

- Subidor de carátula 1024×1024 con optimización automática de imagen.
- Selector de categoría e idioma con dropdown estilizado.
- Campo de título y sinopsis con contador de caracteres (máx. 300).
- Selector de tags populares predefinidos y campo para tags personalizados.
- Dos acciones finales: **Guardar como Borrador** (`status: 'draft'`) o **Enviar a Revisión** (`status: 'in_review'`).

#### 3.3. Administrar Episodios / Subir Episodio (`src/js/views/upload-episode.js`)

Cuando el creador pulsa **ADMINISTRAR** en una serie publicada, accede a esta vista que combina:

- **Banner de Contexto de Serie**: Miniatura (`w-14 h-14 rounded-2xl`), etiqueta "Serie Seleccionada" y título de la serie.
- **Formulario de Nuevo Capítulo**:
  - Campo de título del episodio.
  - Número de capítulo (autoincremental).
  - Descripción opcional.
  - **Zona de Carga de Audio**: Aceptación de archivos MP3 y WAV, detección automática de duración del archivo, zona de arrastre (drag & drop) con estado visual activo.
  - **Carátula de Episodio Opcional**: Permite subir una imagen específica para el capítulo, independiente de la carátula de serie.
  - **Barra de Progreso en Tiempo Real**: Durante la subida a Firebase Storage, utiliza `uploadBytesResumable()` para mostrar progreso porcentual con barra visual animada.
  - Al completar: crea el documento del episodio en Firestore con `audioUrl`, `duration`, `seriesId`, `creatorId`, `imageUrl` y `createdAt`.

#### 3.4. Panel de Finanzas (`src/js/views/finances.js`)

- **Tarjeta de Ganancias Totales**: Cifra destacada en `$1.578.900 COP` con tipografía extra bold.
- **Tarjeta de Saldo Disponible**: Fondo con gradiente azul, monto disponible y botón de retiro.
- **Gráfica Mensual Interactiva**: 6 barras verticales representando meses (ENE - JUN), proporcionales a ingresos, con tooltip al hover.
- **Historial de Transacciones Recientes**: Lista cronológica con tipo de transacción, monto y fecha.

#### 3.5. Reseñas de la Comunidad (`src/js/views/comments.js`)

- **Tarjeta de Rendimiento Global**: Cuadrícula de 3 columnas mostrando calificación promedio (estrellas), seguidores totales y reseñas totales.
- **Selector de Series del Creador**: Permite alternar entre series para ver las reseñas correspondientes.
- **Feed de Reseñas**: Agrupadas por capítulo, con avatar del usuario, nombre, calificación con estrellas y contenido del comentario.

---

## 📁 Estructura del Proyecto

```text
In Java sónica/
├── index.html                   # Shell principal de la app móvil (meta viewport, safe areas)
├── package.json                 # Dependencias y scripts del proyecto
├── vite.config.js               # Configuración de Vite con Tailwind y soporte de host móvil
├── walkthrough.md               # Registro detallado de la arquitectura y componentes
├── public/                      # Recursos estáticos servidos en la raíz
│   ├── logo.png                 # Isotipo y logotipo oficial de Sónica
│   ├── Avatar/                  # Colección de 27 avatares oficiales
│   └── Categorias/              # Imágenes oficiales para las 15 categorías sonoras
└── src/
    ├── index.css                # Estilos globales, variables de color neón y safe-areas
    └── js/
        ├── main.js              # Punto de entrada de la aplicación
        ├── router.js            # HashRouter de rutas móviles
        ├── auth.js              # Manejo del estado de autenticación y usuarios
        ├── firebase.js          # Inicialización de Auth, Firestore y Storage
        ├── player.js            # Motor de audio HTML5, mini-player y sincronización
        ├── layout.js            # Estructura de shell móvil (TopBar y Bottom Navigation)
        ├── icons.js             # Generador dinámico de Lucide Icons
        ├── utils.js             # Formateadores de fecha, tiempo y utilidades UI
        ├── components/          # Componentes reutilizables
        └── views/               # Pantallas completas de la aplicación móvil
            ├── home.js          # Pantalla de Inicio
            ├── explore.js       # Explorador y búsqueda
            ├── category.js      # Detalle por categoría sonora
            ├── series.js        # Vista de serie y capítulos
            ├── episode.js       # Detalle de capítulo
            ├── player.js        # Reproductor a pantalla completa
            ├── subscriptions.js # Suscripciones y biblioteca
            ├── profile.js       # Perfil del usuario y ajustes
            ├── avatar-picker.js # Selector visual de avatar
            ├── creator.js       # Dashboard de creador
            ├── new-series.js    # Formulario para nueva serie
            ├── upload-episode.js# Subida de audio a Storage
            ├── finances.js      # Métricas y finanzas del creador
            ├── comments.js      # Gestión de comentarios y feedback
            ├── login.js         # Inicio de sesión móvil
            └── register.js      # Registro de nuevos oyentes/creadores
```

---

## 🛠️ Instalación y Ejecución

### Requisitos Previos
- **Node.js** v18.0.0 o superior instalado en tu sistema.
- **npm** o gestor de paquetes compatible.

### 1. Clonar o acceder al directorio del proyecto:
```bash
cd "In Java sónica"
```

### 2. Instalar dependencias:
```bash
npm install
```

### 3. Iniciar el Servidor de Desarrollo:
```bash
npm run dev
```

El servidor quedará disponible en:
- **Local (PC):** [http://localhost:5173/](http://localhost:5173/)
- **Dispositivos Móviles en la misma Red Wi-Fi:** `http://<TU_IP_LOCAL>:5173/` *(ejemplo: `http://192.168.1.13:5173/`)*.

### 4. Compilar para Producción:
```bash
npm run build
```
Genera los archivos estáticos listos para producción en la carpeta `dist/`.

### 5. Previsualizar la Compilación:
```bash
npm run preview
```

---

## 📲 Cómo Probar y Ejecutar en Android e iOS

### Opción A: Navegador Móvil Directo (Recomendada para Desarrollo)
1. Asegúrate de que tu computadora y tu teléfono inteligente (Android o iPhone) estén conectados a la **misma red Wi-Fi**.
2. Inicia el servidor con `npm run dev`.
3. En el navegador de tu teléfono (**Google Chrome** en Android o **Safari** en iOS), abre la URL de red indicada en la terminal (ejemplo: `http://192.168.1.13:5173/`).
4. **Instalar como PWA (Web App de Pantalla Completa)**:
   - **En iOS (Safari)**: Pulsa el botón *Compartir* (cuadrado con flecha hacia arriba) y selecciona **"Agregar a pantalla de inicio"**.
   - **En Android (Chrome)**: Pulsa los tres puntos del menú y selecciona **"Instalar aplicación"** o **"Agregar a pantalla principal"**.
   - La aplicación se abrirá en modo nativo sin barras de navegación del navegador.

### Opción B: Emulación Móvil en DevTools
1. Abre [http://localhost:5173/](http://localhost:5173/) en Google Chrome / Brave / Edge.
2. Abre las herramientas de desarrollador (`F12` o `Ctrl + Shift + I`).
3. Activa la barra de emulación de dispositivos (`Ctrl + Shift + M`).
4. Selecciona cualquier modelo móvil (**iPhone 14/15 Pro Max**, **Pixel 7**, **Samsung Galaxy S20/S22**) para probar la disposición táctil, el notch y las áreas seguras.

### Opción C: Empaquetado Nativo (APK Android / IPA iOS)
Para compilar la aplicación como binario instalable en **Google Play Store** y **Apple App Store**, se puede utilizar **Capacitor**:
```bash
# 1. Instalar Capacitor Core y CLI
npm install @capacitor/core @capacitor/cli

# 2. Inicializar Capacitor
npx cap init "Sónica" "com.sonica.app" --web-dir "dist"

# 3. Construir la versión de producción web
npm run build

# 4. Agregar las plataformas nativas
npm install @capacitor/android @capacitor/ios
npx cap add android
npx cap add ios

# 5. Sincronizar y abrir en Android Studio / Xcode
npx cap copy
npx cap open android   # Abre Android Studio para generar el APK / AAB
npx cap open ios       # Abre Xcode (en macOS) para compilar en iPhone
```

---

## 🔒 Configuración de Firebase y Base de Datos

La aplicación se comunica con Firebase mediante las credenciales configuradas en `src/js/firebase.js`:
- **Auth**: Autenticación segura persistente (Google y Email/Password).
- **Firestore**: Colecciones `users`, `series`, `episodes`, `comments`, `view_logs`, `notifications`.
- **Storage**: Cubo `gen-lang-client-0419375849.firebasestorage.app` para almacenamiento de carátulas y pistas de audio.

---

## 📄 Licencia

Este proyecto es propiedad privada para el ecosistema **Sónica Audio & Podcasts**. Todos los derechos reservados.
