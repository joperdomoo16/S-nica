import { 
  db, 
  auth, 
  doc, 
  getDoc, 
  collection, 
  query,
  where,
  getDocs,
  addDoc, 
  updateDoc,
  serverTimestamp, 
  storage, 
  ref, 
  uploadBytesResumable, 
  getDownloadURL 
} from '../firebase.js';
import { icon } from '../icons.js';
import { optimizeImage, cn } from '../utils.js';

export function renderUploadEpisode(container, seriesId) {
  const user = auth.currentUser;
  if (!user) {
    window.location.hash = '#/login';
    return;
  }

  // Estado base de la Serie y el Episodio
  let seriesData = null;
  let title = '';
  let number = '01';
  let description = '';
  let audioFile = null;
  let coverImageFile = null;
  let coverImagePreview = null;
  let audioDuration = '00:00';
  let durationSeconds = 0;
  let audioError = null;
  let generalError = null;
  let isSubmitting = false;
  let uploadProgress = 0;

  // Estado de IA y Modales
  let audioType = 'upload'; // 'upload' | 'ai'
  let showAiOptionsModal = false;
  let showAiVoiceScreen = false;
  let showEnhanceModal = false;
  let showCreateVoiceModal = false;
  let showCalendarModal = false;
  let showSuccessModal = false;
  let selectedDate = null;
  let isPlayingPreview = false;

  // Selección de ambiente para mejorar el audio
  let selectedEnhanceAmbience = 'lluvia';

  // Estado del guion de AI Studio
  let script = {
    modo: 'dialogos', // 'dialogos' | 'narrador' | 'mixto'
    lineas: [
      { id: '1', characterId: 'c1', texto: '', efectoFondo: 'none', efectoLoop: false, solaparConAnterior: false },
      { id: '2', characterId: 'c2', texto: '', efectoFondo: 'none', efectoLoop: false, solaparConAnterior: false }
    ]
  };

  let characters = [
    { id: 'narrador', name: 'Narrador', voiceId: 'es-standard-1', isNarrator: true },
    { id: 'c1', name: 'Personaje 1', voiceId: 'es-standard-2' },
    { id: 'c2', name: 'Personaje 2', voiceId: 'es-standard-3' }
  ];

  // Campos del modal de Voz Personalizada
  let newVoiceName = '';
  let newVoiceDescription = '';
  let isCreatingVoice = false;

  const SFX_OPTIONS = [
    { id: 'none', label: 'Sin Efecto de Fondo' },
    { id: 'lluvia', label: '🌧️ Lluvia Suave' },
    { id: 'tormenta', label: '⛈️ Tormenta & Viento' },
    { id: 'pasos', label: '👣 Pasos en la Noche' },
    { id: 'cafeteria', label: '☕ Cafetería / Murmullos' },
    { id: 'suspenso', label: '🎻 Tensión & Suspenso' },
    { id: 'ciudad', label: '🚗 Tráfico Urbano' },
    { id: 'espacio', label: '🪐 Atmósfera Espacial' },
    { id: 'eco', label: '🏛️ Eco / Cueva Profunda' }
  ];

  const ALL_STANDARD_VOICES = [
    // Español
    { id: 'es-standard-1', name: 'Mateo (Voz Profunda - Narración)', lang: 'es-ES' },
    { id: 'es-standard-2', name: 'Valentina (Joven - Enérgica)', lang: 'es-CO' },
    { id: 'es-standard-3', name: 'Alejandro (Maduro - Cine)', lang: 'es-MX' },
    { id: 'es-standard-4', name: 'Camila (Cálida - Misterio)', lang: 'es-AR' },
    { id: 'es-standard-5', name: 'Sebastián (Dinámico - Acción)', lang: 'es-ES' },
    // Inglés
    { id: 'en-standard-1', name: 'Matthew (Deep Voice - Narration)', lang: 'en-US' },
    { id: 'en-standard-2', name: 'Emma (Young - Energetic)', lang: 'en-GB' },
    { id: 'en-standard-3', name: 'James (Mature - Cinematic)', lang: 'en-US' },
    { id: 'en-standard-4', name: 'Sophia (Warm - Mystery)', lang: 'en-AU' },
    { id: 'en-standard-5', name: 'Michael (Dynamic - Action)', lang: 'en-US' },
  ];

  let STANDARD_VOICES = ALL_STANDARD_VOICES.filter(v => v.lang.startsWith('es'));

  // Cargar datos de la serie y recuento de episodios para autoincrementar el número del capítulo
  async function loadData() {
    try {
      const snap = await getDoc(doc(db, 'series', seriesId));
      if (snap.exists()) {
        seriesData = { id: snap.id, ...snap.data() };
        
        // Filtrar voces por idioma de la serie
        const langPrefix = seriesData.language === 'Inglés' ? 'en' :
                           'es'; // default to Español
        
        STANDARD_VOICES = ALL_STANDARD_VOICES.filter(v => v.lang.startsWith(langPrefix));
        
        if (seriesData.characters && Array.isArray(seriesData.characters) && seriesData.characters.length > 0) {
          characters = seriesData.characters;
        }
        
        // Asegurarse de que los personajes iniciales usen voces válidas para el idioma
        characters.forEach((char, idx) => {
           if (!char.voiceId.startsWith(langPrefix)) {
               char.voiceId = STANDARD_VOICES[idx % STANDARD_VOICES.length]?.id || STANDARD_VOICES[0].id;
           }
        });
      }

      const qEp = query(collection(db, 'episodes'), where('seriesId', '==', seriesId));
      const epSnap = await getDocs(qEp);
      let maxNum = 0;
      epSnap.forEach(d => {
        const num = parseInt(d.data().number, 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      });
      number = (maxNum + 1).toString().padStart(2, '0');
    } catch (e) {
      console.error("Error loading series/episodes in upload:", e);
    }
    render();
  }

  // Previsualización de Audio mediante Síntesis de Voz
  function stopAudioPreview() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    isPlayingPreview = false;
    render();
  }

  function startAudioPreview() {
    if (!window.speechSynthesis) {
      alert("Tu navegador no soporta síntesis de voz interactiva.");
      return;
    }

    if (isPlayingPreview) {
      stopAudioPreview();
      return;
    }

    const validLines = script.lineas.filter(l => l.texto && l.texto.trim().length > 0);
    if (validLines.length === 0) {
      alert("Agrega texto a los diálogos para poder previsualizarlos.");
      return;
    }

    isPlayingPreview = true;
    render();

    const langPrefix = seriesData?.language === 'Inglés' ? 'en' :
                       'es';

    const voices = window.speechSynthesis.getVoices();
    const targetLangVoices = voices.filter(v => v.lang.startsWith(langPrefix));

    let lineIndex = 0;

    function playNext() {
      if (!isPlayingPreview || lineIndex >= validLines.length) {
        isPlayingPreview = false;
        render();
        return;
      }

      const current = validLines[lineIndex];
      const rawText = current.texto;

      // Extraer etiquetas de emoción como [susurro], [feliz], [enojado], [triste], [miedo]
      const emotionMatch = rawText.match(/\[(.*?)\]/);
      const emotion = emotionMatch ? emotionMatch[1].toLowerCase().trim() : '';
      const cleanText = rawText.replace(/\[(.*?)\]/g, '').trim();

      const utterance = new SpeechSynthesisUtterance(cleanText || rawText);
      utterance.lang = langPrefix === 'en' ? 'en-US' : 
                       'es-ES';

      // Elegir una voz distintiva para el personaje
      if (targetLangVoices.length > 0) {
        const charIdx = characters.findIndex(c => c.id === current.characterId);
        utterance.voice = targetLangVoices[Math.max(0, charIdx) % targetLangVoices.length];
      }

      // Modular la expresión vocal según la emoción
      if (emotion) {
        if (['triste', 'sad', 'melancolico', 'melancólico', 'llanto'].some(e => emotion.includes(e))) {
          utterance.pitch = 0.75;
          utterance.rate = 0.8;
        } else if (['enojado', 'angry', 'furioso', 'ira', 'grito'].some(e => emotion.includes(e))) {
          utterance.pitch = 1.35;
          utterance.rate = 1.15;
        } else if (['feliz', 'happy', 'alegre', 'entusiasta'].some(e => emotion.includes(e))) {
          utterance.pitch = 1.2;
          utterance.rate = 1.05;
        } else if (['susurro', 'whisper', 'secreto', 'silencio'].some(e => emotion.includes(e))) {
          utterance.pitch = 0.85;
          utterance.rate = 0.75;
          utterance.volume = 0.45;
        } else if (['miedo', 'terror', 'nervioso'].some(e => emotion.includes(e))) {
          utterance.pitch = 1.3;
          utterance.rate = 1.2;
        }
      }

      utterance.onend = () => {
        lineIndex++;
        // Breve pausa entre líneas
        setTimeout(playNext, current.solaparConAnterior ? 100 : 400);
      };

      utterance.onerror = () => {
        isPlayingPreview = false;
        render();
      };

      window.speechSynthesis.speak(utterance);
    }

    playNext();
  }

  // Manejar Guardado de Guion IA
  function handleSaveAiScript() {
    stopAudioPreview();
    showAiVoiceScreen = false;
    audioType = 'ai';

    // Calcular duración aproximada basada en el conteo de palabras (~130 palabras por minuto)
    const totalWords = script.lineas.reduce((acc, l) => acc + (l.texto ? l.texto.trim().split(/\s+/).length : 0), 0);
    const estMinutes = Math.max(1, Math.round(totalWords / 130));
    audioDuration = `${estMinutes.toString().padStart(2, '0')}:00 min (IA)`;
    durationSeconds = estMinutes * 60;
    generalError = null;
    render();
  }

  // Manejar Guardado de Episodio en Firestore y Storage
  async function handlePublishEpisode(status = 'in_review') {
    if (!title.trim()) {
      alert("Por favor ingresa un título para el episodio.");
      return;
    }

    if (audioType === 'upload' && !audioFile) {
      alert("Debes seleccionar un archivo de audio o generar un diálogo con Voz IA.");
      return;
    }

    if (audioType === 'ai') {
      const hasLines = script.lineas.some(l => l.texto && l.texto.trim().length > 0);
      if (!hasLines) {
        alert("El guion de IA está vacío. Diseña al menos una línea de diálogo.");
        return;
      }
    }

    isSubmitting = true;
    uploadProgress = 10;
    render();

    try {
      let finalAudioUrl = '';
      let finalImageUrl = coverImagePreview || seriesData?.thumbnail || '';

      // 1. Subir audio si es un archivo local
      if (audioFile) {
        const cleanName = audioFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const audioPath = `episodes/${user.uid}/${seriesId}/${Date.now()}_${cleanName}`;
        const audioRef = ref(storage, audioPath);
        const uploadTask = uploadBytesResumable(audioRef, audioFile);

        finalAudioUrl = await new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snap) => {
              const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 70);
              uploadProgress = 10 + pct;
              renderProgressBar();
            },
            (err) => reject(err),
            async () => {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(url);
            }
          );
        });
      }

      // 2. Subir imagen de portada si se proporciona
      if (coverImageFile) {
        uploadProgress = 85;
        renderProgressBar();
        const cleanImg = coverImageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const imgPath = `episodes/${user.uid}/${seriesId}/${Date.now()}_cover_${cleanImg}`;
        const imgRef = ref(storage, imgPath);
        const imgTask = uploadBytesResumable(imgRef, coverImageFile);
        await imgTask;
        finalImageUrl = await getDownloadURL(imgTask.snapshot.ref);
      }

      uploadProgress = 95;
      renderProgressBar();

      // 3. Guardar episodio en Firestore
      const epData = {
        seriesId,
        creatorId: user.uid,
        number: number.toString(),
        title: title.trim(),
        description: description.trim(),
        audioUrl: finalAudioUrl,
        imageUrl: finalImageUrl,
        thumbnail: finalImageUrl,
        duration: audioDuration,
        actualDuration: durationSeconds,
        status: 'publicado', // Published / Active
        isAiVoice: audioType === 'ai',
        script: audioType === 'ai' ? script : null,
        scheduledDate: selectedDate ? selectedDate.toISOString() : null,
        createdAt: serverTimestamp(),
        views: 0
      };

      await addDoc(collection(db, 'episodes'), epData);

      // Si es IA, actualizar personajes de la serie para que futuros episodios puedan reutilizarlos
      if (audioType === 'ai') {
        try {
          await updateDoc(doc(db, 'series', seriesId), { characters });
        } catch (_) {}
      }

      uploadProgress = 100;
      alert("¡Capítulo publicado y disponible con éxito!");
      window.location.hash = `#/creator/manage/${seriesId}`;
    } catch (err) {
      console.error("Episode upload error:", err);
      alert("Hubo un error al guardar el episodio: " + (err.message || 'Error desconocido'));
      isSubmitting = false;
      render();
    }
  }

  function renderProgressBar() {
    const bar = container.querySelector('#upload-progress-fill');
    const label = container.querySelector('#upload-progress-text');
    if (bar) bar.style.width = `${uploadProgress}%`;
    if (label) label.textContent = `${uploadProgress}%`;
  }

  function render() {
    const isFormValid = title.trim() !== '' && 
      (audioType === 'upload' ? audioFile !== null : script.lineas.some(l => l.texto.trim().length > 0)) && 
      !isSubmitting;

    container.innerHTML = `
      <div class="bg-surface-dim min-h-screen text-white pb-36">
        <div class="px-6 pt-8 max-w-lg mx-auto space-y-8">
          
          <!-- Top Navigation Header -->
          <div class="flex items-center gap-4">
            <button id="btn-back-upload" class="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-primary active:scale-95 transition-all cursor-pointer shadow-lg">
              ${icon('arrowLeft', { size: 22, strokeWidth: 3 })}
            </button>
            <div>
              <p class="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-400">NUEVO CAPÍTULO</p>
              <h1 class="text-2xl font-black font-headline uppercase italic">Subir Episodio</h1>
            </div>
          </div>

          <!-- Series Context Banner -->
          ${seriesData ? `
            <div class="bg-surface-container-high/40 p-4 rounded-3xl border border-white/5 flex items-center gap-4 shadow-xl">
              <img 
                src="${seriesData.thumbnail || '/Categorias/Ciencia Ficcion.png'}" 
                class="w-14 h-14 rounded-2xl object-cover border border-white/10 shadow-md" 
                referrerpolicy="no-referrer"
              />
              <div class="min-w-0 flex-1">
                <span class="text-[9px] font-black uppercase text-cyan-400 tracking-widest">Serie Seleccionada</span>
                <h4 class="text-sm font-black uppercase italic text-white line-clamp-1">${seriesData.title}</h4>
              </div>
            </div>
          ` : ''}

          <!-- Method Selector (Upload File vs AI Voice) -->
          <div class="space-y-3">
            <label class="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 ml-1">
              Método de Audio
            </label>
            <div class="grid grid-cols-2 gap-3 bg-surface-container-highest/20 p-1.5 rounded-2xl border border-white/5">
              <button 
                id="btn-tab-upload"
                type="button"
                class="${cn(
                  "py-3.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95",
                  audioType === 'upload' 
                    ? "primary-gradient text-surface-dim shadow-lg font-black" 
                    : "text-on-surface-variant hover:text-white"
                )}"
              >
                ${icon('upload', { size: 16, strokeWidth: 2.5 })}
                Subir Archivo
              </button>

              <button 
                id="btn-tab-ai"
                type="button"
                class="${cn(
                  "py-3.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95",
                  audioType === 'ai' 
                    ? "primary-gradient text-surface-dim shadow-lg font-black shadow-cyan-400/20" 
                    : "text-on-surface-variant hover:text-white"
                )}"
              >
                ${icon('sparkles', { size: 16, strokeWidth: 2.5 })}
                Voz IA
              </button>
            </div>
          </div>

          <!-- Audio Input Area (File upload OR AI Script overview) -->
          <div class="space-y-3">
            ${audioType === 'upload' ? `
              <div class="space-y-2">
                <label class="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 ml-1">
                  Archivo de Audio (MP3 / WAV / M4A)
                </label>
                <label class="w-full flex flex-col items-center justify-center p-8 rounded-3xl border-2 border-dashed ${audioError ? 'border-red-500/60 bg-red-500/5' : 'border-white/20 hover:border-cyan-400'} transition-all cursor-pointer bg-surface-container-high/30 group">
                  <input type="file" id="input-audio-file" accept="audio/*" class="hidden" />
                  <div class="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-cyan-400 mb-3 group-hover:scale-110 transition-transform">
                    ${icon('upload', { size: 28, strokeWidth: 2.5 })}
                  </div>
                  <p class="text-sm font-bold text-white text-center line-clamp-1">
                    ${audioFile ? audioFile.name : 'Toca o arrastra el audio del episodio'}
                  </p>
                  ${audioFile ? `
                    <p class="text-[11px] text-cyan-400 font-bold mt-1 tracking-wider uppercase">
                      ${(audioFile.size / (1024 * 1024)).toFixed(2)} MB • Duración: ${audioDuration}
                    </p>
                  ` : `
                    <p class="text-[10px] text-on-surface-variant/50 font-medium uppercase tracking-wider mt-1">Máximo 15 min / 200 MB</p>
                  `}
                </label>
                ${audioError ? `<p class="text-xs text-red-400 font-bold mt-1">${audioError}</p>` : ''}
              </div>
            ` : `
              <!-- AI Voice Designed Card -->
              <div class="space-y-2">
                <label class="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 ml-1">
                  Guion y Voces de IA
                </label>
                <div class="bg-gradient-to-br from-cyan-950/40 via-surface-container-high/40 to-surface-container-high/20 border border-cyan-400/30 rounded-3xl p-6 space-y-4 shadow-xl">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <div class="w-12 h-12 rounded-2xl bg-cyan-400/20 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-400/10">
                        ${icon('sparkles', { size: 24, strokeWidth: 2.5 })}
                      </div>
                      <div>
                        <h4 class="text-base font-black font-headline uppercase italic text-white">
                          ${script.modo === 'dialogos' ? 'Diálogo Multivoz' : (script.modo === 'narrador' ? 'Narración con Voz IA' : 'Modo Mixto (Voces + Narrador)')}
                        </h4>
                        <p class="text-xs text-cyan-400 font-black uppercase tracking-widest mt-0.5">
                          ${script.lineas.filter(l => l.texto.trim()).length} Líneas configuradas • ${audioDuration}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-3 pt-2">
                    <button 
                      id="btn-open-ai-studio"
                      type="button"
                      class="py-3 px-4 bg-cyan-400/15 hover:bg-cyan-400/25 border border-cyan-400/40 rounded-2xl font-black text-xs uppercase tracking-widest text-cyan-400 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                    >
                      ${icon('edit3', { size: 14, strokeWidth: 2.5 })}
                      Editar Guion
                    </button>

                    <button 
                      id="btn-preview-audio-main"
                      type="button"
                      class="py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest text-white flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                    >
                      ${isPlayingPreview ? icon('square', { size: 14 }) : icon('play', { size: 14 })}
                      ${isPlayingPreview ? 'Detener' : 'Preescuchar'}
                    </button>
                  </div>
                </div>
              </div>
            `}
          </div>

          <!-- Episode Number & Title -->
          <div class="grid grid-cols-3 gap-4">
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 ml-1">Capítulo #</label>
              <input 
                type="text" 
                id="input-ep-number" 
                value="${number}" 
                class="w-full bg-surface-container-high rounded-2xl px-5 py-4 text-white font-black text-center outline-none focus:ring-2 focus:ring-cyan-400/40 border border-white/5"
              />
            </div>
            <div class="col-span-2 space-y-2">
              <label class="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 ml-1">Título del Episodio</label>
              <input 
                type="text" 
                id="input-ep-title" 
                value="${title}" 
                placeholder="Ej. El Despertar"
                class="w-full bg-surface-container-high rounded-2xl px-5 py-4 text-white font-medium outline-none focus:ring-2 focus:ring-cyan-400/40 border border-white/5"
              />
            </div>
          </div>

          <!-- Description -->
          <div class="space-y-2">
            <div class="flex items-center justify-between ml-1">
              <label class="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">Sinopsis del Episodio</label>
              <span class="text-[9px] font-black text-on-surface-variant/40 tracking-widest">${description.length}/200</span>
            </div>
            <textarea 
              id="textarea-ep-desc" 
              rows="3" 
              maxlength="200"
              placeholder="¿Qué sucesos ocurren en este capítulo?..."
              class="w-full bg-surface-container-high rounded-2xl p-5 text-white font-medium outline-none focus:ring-2 focus:ring-cyan-400/40 border border-white/5 resize-none text-sm"
            >${description}</textarea>
          </div>

          <!-- Cover Image Uploader (Optional) -->
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 ml-1">
              Portada del Capítulo (Opcional)
            </label>
            <label class="w-full h-44 rounded-3xl bg-surface-container-high/40 border border-white/10 flex flex-col items-center justify-center cursor-pointer group overflow-hidden relative shadow-xl hover:border-cyan-400/50 transition-colors">
              <input type="file" id="input-cover-file" accept="image/*" class="hidden" />
              ${coverImagePreview ? `
                <img src="${coverImagePreview}" class="w-full h-full object-cover" />
                <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span class="text-xs font-black uppercase tracking-widest text-cyan-400">Cambiar Imagen</span>
                </div>
              ` : `
                <div class="flex flex-col items-center justify-center text-center p-4">
                  <div class="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-cyan-400 mb-2 group-hover:scale-110 transition-transform">
                    ${icon('imagePlus', { size: 24 })}
                  </div>
                  <span class="text-xs font-bold text-white">Subir Portada Específica</span>
                  <p class="text-[10px] text-on-surface-variant/40 uppercase tracking-widest mt-1">Si no se sube, se usará la carátula de la serie</p>
                </div>
              `}
            </label>
          </div>

          <!-- Progress Bar (if uploading) -->
          ${isSubmitting ? `
            <div class="space-y-2 p-6 bg-surface-container-high/60 rounded-3xl border border-cyan-400/30 shadow-2xl">
              <div class="flex justify-between text-xs font-black uppercase tracking-wider text-cyan-400">
                <span>Guardando Episodio...</span>
                <span id="upload-progress-text">${uploadProgress}%</span>
              </div>
              <div class="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                <div id="upload-progress-fill" class="h-full bg-cyan-400 transition-all duration-300 shadow-[0_0_15px_rgba(0,229,255,0.8)]" style="width: ${uploadProgress}%"></div>
              </div>
            </div>
          ` : ''}

          <!-- Action Buttons -->
          <div class="space-y-3 pt-4">
            <button 
              id="btn-publish-submit"
              type="button"
              ${!isFormValid ? 'disabled' : ''}
              class="w-full py-5 primary-gradient rounded-full font-black text-sm uppercase tracking-widest text-surface-dim shadow-2xl active:scale-95 transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-3 shadow-cyan-400/25"
            >
              ${isSubmitting 
                ? `${icon('loader2', { size: 20, className: 'animate-spin' })} Procesando...`
                : `${icon('checkCircle2', { size: 20, strokeWidth: 2.5 })} Publicar Capítulo`}
            </button>

            <button 
              id="btn-open-schedule"
              type="button"
              ${!isFormValid ? 'disabled' : ''}
              class="w-full py-4 bg-surface-container-high/50 hover:bg-surface-container-high border border-white/10 text-white rounded-full font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
            >
              ${icon('calendar', { size: 16, className: 'text-cyan-400' })}
              ${selectedDate ? `Estreno Programado (${selectedDate.toLocaleDateString()})` : 'Programar Publicación'}
            </button>

            <p class="text-[9.5px] text-center text-on-surface-variant/50 leading-relaxed font-medium italic px-6 pt-2">
              Al publicar, confirmas que posees los derechos de autor de este contenido o estás usando voces bajo licencia.
            </p>
          </div>
        </div>

        <!-- ========================================== -->
        <!-- MODAL: AI OPTIONS (Creación vs Mejora)      -->
        <!-- ========================================== -->
        ${showAiOptionsModal ? `
          <div class="fixed inset-0 z-[120] flex items-center justify-center p-6 pb-20">
            <div id="ai-options-backdrop" class="absolute inset-0 bg-black/85 backdrop-blur-md"></div>
            <div class="relative w-full max-w-sm bg-[#16181f] border border-white/10 rounded-[2.5rem] p-7 shadow-2xl space-y-6 text-center">
              
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-black text-cyan-400 uppercase tracking-[0.3em]">ESTUDIO INTELIGENTE</span>
                <button id="btn-close-ai-options" class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white cursor-pointer">
                  ${icon('x', { size: 16 })}
                </button>
              </div>

              <div class="space-y-2 text-left">
                <h3 class="text-2xl font-black font-headline uppercase italic text-white">
                  Opciones de IA
                </h3>
                <p class="text-xs text-on-surface-variant/70 font-medium">
                  Elige cómo deseas producir o perfeccionar el audio de tu capítulo:
                </p>
              </div>

              <div class="flex flex-col gap-4">
                <!-- Option 1: Creación Completa -->
                <button 
                  id="btn-opt-full-ai"
                  type="button"
                  class="w-full text-left bg-surface-container-highest/20 hover:bg-surface-container-highest/40 border border-cyan-400/30 rounded-3xl p-5 shadow-xl transition-all group active:scale-[0.98] cursor-pointer"
                >
                  <div class="flex items-start gap-4">
                    <div class="w-12 h-12 shrink-0 rounded-2xl bg-cyan-400/15 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform shadow-lg shadow-cyan-400/10">
                      ${icon('sparkles', { size: 22, strokeWidth: 2.5 })}
                    </div>
                    <div class="space-y-1">
                      <h4 class="text-sm font-black text-white uppercase tracking-wider">Creación Completa</h4>
                      <p class="text-xs text-on-surface-variant/70 font-medium leading-relaxed">
                        Selecciona voces, crea diálogos y añade efectos sonoros de ambientación.
                      </p>
                    </div>
                  </div>
                </button>

                <!-- Option 2: Mejora tu Audio -->
                <button 
                  id="btn-opt-enhance-audio"
                  type="button"
                  class="w-full text-left bg-surface-container-highest/20 hover:bg-surface-container-highest/40 border border-purple-500/30 rounded-3xl p-5 shadow-xl transition-all group active:scale-[0.98] cursor-pointer"
                >
                  <div class="flex items-start gap-4">
                    <div class="w-12 h-12 shrink-0 rounded-2xl bg-purple-500/15 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform shadow-lg shadow-purple-500/10">
                      ${icon('volume2', { size: 22, strokeWidth: 2.5 })}
                    </div>
                    <div class="space-y-1">
                      <h4 class="text-sm font-black text-white uppercase tracking-wider">Mejora tu Audio</h4>
                      <p class="text-xs text-on-surface-variant/70 font-medium leading-relaxed">
                        ¿Ya grabaste tu voz? Añade capas sonoras y efectos ambientales para un acabado cinematográfico.
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- ========================================== -->
        <!-- SCREEN: FULL-SCREEN AI VOICE STUDIO        -->
        <!-- ========================================== -->
        ${showAiVoiceScreen ? `
          <div class="fixed inset-0 bg-[#0a0b0e] text-white z-[130] flex flex-col h-screen overflow-hidden">
            <!-- Header -->
            <header class="px-6 pt-12 pb-5 flex items-center justify-between border-b border-white/5 shrink-0 bg-[#0a0b0e]/95 backdrop-blur-xl">
              <div class="flex items-center gap-4">
                <button id="btn-close-ai-screen" class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-cyan-400 active:scale-90 cursor-pointer">
                  ${icon('arrowLeft', { size: 22, strokeWidth: 3 })}
                </button>
                <div>
                  <span class="text-[9px] font-black text-cyan-400 uppercase tracking-[0.25em]">CREACIÓN DE GUION</span>
                  <h1 class="text-lg font-black font-headline text-white tracking-tight uppercase italic">Generar con Voz IA</h1>
                </div>
              </div>

              <button 
                id="btn-open-create-voice" 
                class="px-3.5 py-2 bg-cyan-400/10 hover:bg-cyan-400/20 border border-cyan-400/30 rounded-xl text-cyan-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 active:scale-95 cursor-pointer"
              >
                ${icon('mic', { size: 14 })}
                + Diseñar Voz
              </button>
            </header>

            <!-- Mode Selector (Diálogos, Narrador, Mixto) -->
            <div class="px-6 py-4 shrink-0 bg-[#0e1017] border-b border-white/5">
              <div class="grid grid-cols-3 gap-2 bg-black/40 p-1 rounded-full border border-white/10 shadow-inner">
                <button
                  type="button"
                  data-script-mode="dialogos"
                  class="${cn(
                    "h-10 rounded-full text-xs font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center cursor-pointer",
                    script.modo === 'dialogos' ? "bg-cyan-400 text-black shadow-lg shadow-cyan-400/20 font-black" : "text-white/60 hover:text-white"
                  )}"
                >
                  Diálogos
                </button>
                <button
                  type="button"
                  data-script-mode="narrador"
                  class="${cn(
                    "h-10 rounded-full text-xs font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center cursor-pointer",
                    script.modo === 'narrador' ? "bg-cyan-400 text-black shadow-lg shadow-cyan-400/20 font-black" : "text-white/60 hover:text-white"
                  )}"
                >
                  Narrador
                </button>
                <button
                  type="button"
                  data-script-mode="mixto"
                  class="${cn(
                    "h-10 rounded-full text-xs font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center cursor-pointer",
                    script.modo === 'mixto' ? "bg-cyan-400 text-black shadow-lg shadow-cyan-400/20 font-black" : "text-white/60 hover:text-white"
                  )}"
                >
                  Mixto
                </button>
              </div>
            </div>

            <!-- Scrollable Content: Characters & Dialogue Lines -->
            <div class="flex-1 overflow-y-auto px-6 py-6 space-y-8 pb-32">
              
              <!-- Character Assignment Section -->
              <section class="space-y-3">
                <div class="flex items-center justify-between">
                  <h3 class="text-xs font-black uppercase tracking-[0.2em] text-cyan-400">Personajes y Voces</h3>
                  ${script.modo !== 'narrador' ? `
                    <button id="btn-add-character" class="text-[10px] font-black uppercase tracking-widest text-primary hover:underline cursor-pointer">
                      + Añadir Personaje
                    </button>
                  ` : ''}
                </div>

                <div class="grid grid-cols-1 gap-3">
                  ${characters
                    .filter(c => script.modo === 'narrador' ? c.isNarrator : (script.modo === 'dialogos' ? !c.isNarrator : true))
                    .map(char => `
                      <div class="bg-surface-container-high/30 border border-white/5 rounded-2xl p-4 flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-cyan-400 shrink-0 font-black text-xs">
                          ${char.name ? char.name.substring(0, 2).toUpperCase() : 'P'}
                        </div>
                        <div class="flex-1 min-w-0">
                          <input 
                            type="text" 
                            data-char-name="${char.id}" 
                            value="${char.name}" 
                            placeholder="Nombre del personaje"
                            class="bg-transparent text-sm font-black text-white outline-none w-full border-b border-transparent focus:border-cyan-400"
                          />
                          <select 
                            data-char-voice="${char.id}"
                            class="bg-transparent text-xs text-on-surface-variant font-medium outline-none w-full mt-1 cursor-pointer"
                          >
                            ${STANDARD_VOICES.map(v => `
                              <option value="${v.id}" ${char.voiceId === v.id ? 'selected' : ''} class="bg-[#1c1d21] text-white">
                                ${v.name}
                              </option>
                            `).join('')}
                          </select>
                        </div>
                        ${!char.isNarrator ? `
                          <button data-remove-char="${char.id}" class="p-2 text-white/30 hover:text-red-400 transition-colors cursor-pointer">
                            ${icon('trash2', { size: 16 })}
                          </button>
                        ` : ''}
                      </div>
                    `).join('')}
                </div>
              </section>

              <!-- Lines Editor -->
              <section class="space-y-4">
                <div class="flex items-center justify-between">
                  <h3 class="text-xs font-black uppercase tracking-[0.2em] text-cyan-400">Líneas de Guion</h3>
                  <span class="text-[10px] text-white/40 font-bold">Usa etiquetas como [susurro], [feliz], [enojado]</span>
                </div>

                <div class="space-y-4">
                  ${script.lineas.map((line, idx) => `
                    <div class="bg-surface-container-high/20 border border-white/5 rounded-3xl p-5 space-y-4 relative group">
                      
                      <!-- Line Header -->
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <span class="text-[10px] font-black text-cyan-400 bg-cyan-400/10 px-2.5 py-1 rounded-full">#${idx + 1}</span>
                          <select 
                            data-line-character="${line.id}"
                            class="bg-surface-container-highest/40 text-xs font-black text-white px-3 py-1.5 rounded-xl border border-white/10 outline-none cursor-pointer"
                          >
                            ${characters.map(c => `
                              <option value="${c.id}" ${line.characterId === c.id ? 'selected' : ''} class="bg-[#1c1d21] text-white">
                                ${c.name}
                              </option>
                            `).join('')}
                          </select>
                        </div>

                        <div class="flex items-center gap-2">
                          ${idx > 0 ? `
                            <button 
                              data-toggle-overlap="${line.id}"
                              class="${cn(
                                "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border transition-all cursor-pointer",
                                line.solaparConAnterior 
                                  ? "bg-cyan-400/20 border-cyan-400 text-cyan-400" 
                                  : "bg-white/5 border-white/10 text-white/40"
                              )}"
                              title="Solapar voz con la línea anterior"
                            >
                              Solapar
                            </button>
                          ` : ''}

                          <button data-delete-line="${line.id}" class="p-2 text-white/30 hover:text-red-400 transition-colors cursor-pointer">
                            ${icon('trash2', { size: 16 })}
                          </button>
                        </div>
                      </div>

                      <!-- Text input for Dialogue -->
                      <textarea 
                        data-line-text="${line.id}"
                        rows="2"
                        placeholder="Escribe lo que dice este personaje... Ej: [susurro] No hagan ruido..."
                        class="w-full bg-black/30 border border-white/5 rounded-2xl p-4 text-sm text-white placeholder:text-white/20 outline-none focus:ring-1 focus:ring-cyan-400/40 resize-none font-medium"
                      >${line.texto}</textarea>

                      <!-- Sound Effect Setting -->
                      <div class="flex items-center justify-between gap-3 pt-1 border-t border-white/5 text-xs">
                        <div class="flex items-center gap-2 flex-1">
                          <span class="text-white/40 font-bold text-[10px] uppercase tracking-wider">Efecto:</span>
                          <select 
                            data-line-sfx="${line.id}"
                            class="bg-black/30 text-xs text-white/80 px-3 py-1.5 rounded-xl border border-white/5 outline-none flex-1 cursor-pointer"
                          >
                            ${SFX_OPTIONS.map(opt => `
                              <option value="${opt.id}" ${line.efectoFondo === opt.id ? 'selected' : ''} class="bg-[#1c1d21] text-white">
                                ${opt.label}
                              </option>
                            `).join('')}
                          </select>
                        </div>

                        <label class="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-white/60">
                          <input 
                            type="checkbox" 
                            data-line-loop="${line.id}" 
                            ${line.efectoLoop ? 'checked' : ''} 
                            class="accent-cyan-400"
                          />
                          Loop
                        </label>
                      </div>
                    </div>
                  `).join('')}
                </div>

                <!-- Add Line Controls -->
                <div class="flex gap-3 pt-2">
                  <button 
                    id="btn-add-line"
                    type="button"
                    class="flex-1 py-4 bg-surface-container-high/40 hover:bg-surface-container-high border border-dashed border-cyan-400/40 rounded-2xl font-black text-xs uppercase tracking-widest text-cyan-400 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                  >
                    ${icon('plus', { size: 16, strokeWidth: 3 })}
                    + Línea de Diálogo
                  </button>

                  <button 
                    id="btn-add-sfx-line"
                    type="button"
                    class="py-4 px-5 bg-white/5 hover:bg-white/10 border border-dashed border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest text-white/60 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                  >
                    + Efecto Solo
                  </button>
                </div>
              </section>
            </div>

            <!-- Bottom Action Footer -->
            <footer class="fixed bottom-0 left-0 w-full p-4 bg-[#0a0b0e]/95 backdrop-blur-xl border-t border-white/10 flex gap-3 z-40">
              <button 
                id="btn-preview-script"
                type="button"
                class="${cn(
                  "flex-1 h-14 rounded-full font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 border transition-all active:scale-95 cursor-pointer",
                  isPlayingPreview 
                    ? "bg-red-500/20 border-red-500/40 text-red-400" 
                    : "bg-surface-container-high border-white/10 text-white hover:bg-white/10"
                )}"
              >
                ${isPlayingPreview ? icon('square', { size: 16 }) : icon('play', { size: 16, className: 'text-cyan-400' })}
                ${isPlayingPreview ? 'Detener Audio' : 'Previsualizar Audio'}
              </button>

              <button 
                id="btn-save-ai-script"
                type="button"
                class="flex-1 h-14 primary-gradient text-surface-dim font-black text-xs uppercase tracking-widest rounded-full flex items-center justify-center gap-2 shadow-xl shadow-cyan-400/20 active:scale-95 cursor-pointer"
              >
                ${icon('checkCircle2', { size: 18, strokeWidth: 3 })}
                Guardar Cambios
              </button>
            </footer>
          </div>
        ` : ''}

        <!-- ========================================== -->
        <!-- MODAL: MEJORA TU AUDIO                     -->
        <!-- ========================================== -->
        ${showEnhanceModal ? `
          <div class="fixed inset-0 z-[125] flex items-center justify-center p-6 pb-20">
            <div id="enhance-modal-backdrop" class="absolute inset-0 bg-black/85 backdrop-blur-md"></div>
            <div class="relative w-full max-w-sm bg-[#16181f] border border-white/10 rounded-[2.5rem] p-7 shadow-2xl space-y-6">
              
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-black text-purple-400 uppercase tracking-[0.3em]">MEJORA ACÚSTICA</span>
                <button id="btn-close-enhance" class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white cursor-pointer">
                  ${icon('x', { size: 16 })}
                </button>
              </div>

              <div class="space-y-2">
                <h3 class="text-xl font-black font-headline uppercase italic text-white">
                  Mejora tu Audio
                </h3>
                <p class="text-xs text-on-surface-variant/70 font-medium">
                  Añade una pista ambiental y efectos de sala para sumergir a tu audiencia en la atmósfera.
                </p>
              </div>

              <div class="space-y-3">
                <label class="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">
                  Ambiente Acústico Principal
                </label>
                <div class="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                  ${SFX_OPTIONS.filter(s => s.id !== 'none').map(s => `
                    <button 
                      type="button" 
                      data-select-enhance="${s.id}"
                      class="${cn(
                        "w-full text-left p-3.5 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-between",
                        selectedEnhanceAmbience === s.id 
                          ? "bg-purple-500/20 border-purple-500 text-purple-300" 
                          : "bg-white/5 border-white/5 text-white/70 hover:bg-white/10"
                      )}"
                    >
                      <span>${s.label}</span>
                      ${selectedEnhanceAmbience === s.id ? icon('check', { size: 14 }) : ''}
                    </button>
                  `).join('')}
                </div>
              </div>

              <div class="pt-2">
                <button 
                  id="btn-apply-enhance"
                  type="button"
                  class="w-full py-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-black text-xs uppercase tracking-widest rounded-full shadow-lg shadow-purple-500/25 active:scale-95 cursor-pointer"
                >
                  Aplicar Efectos al Audio
                </button>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- ========================================== -->
        <!-- MODAL: DISEÑAR VOZ PERSONALIZADA           -->
        <!-- ========================================== -->
        ${showCreateVoiceModal ? `
          <div class="fixed inset-0 z-[140] flex items-center justify-center p-6 pb-20">
            <div id="voice-modal-backdrop" class="absolute inset-0 bg-black/85 backdrop-blur-md"></div>
            <div class="relative w-full max-w-sm bg-[#16181f] border border-white/10 rounded-[2.5rem] p-7 shadow-2xl space-y-6">
              
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-black text-cyan-400 uppercase tracking-[0.3em]">SÍNTESIS VOCAL</span>
                <button id="btn-close-voice-modal" class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white cursor-pointer">
                  ${icon('x', { size: 16 })}
                </button>
              </div>

              <div class="space-y-1">
                <h3 class="text-xl font-black font-headline uppercase italic text-white">Diseñar Voz</h3>
                <p class="text-xs text-on-surface-variant/70 font-medium">Define las características del locutor o personaje.</p>
              </div>

              <div class="space-y-4">
                <div class="space-y-2">
                  <label class="text-[10px] font-black uppercase tracking-widest text-cyan-400">Nombre de la Voz</label>
                  <input 
                    type="text" 
                    id="input-voice-name" 
                    value="${newVoiceName}" 
                    placeholder="Ej. Lord Drakon (Villano)"
                    class="w-full bg-surface-container-high rounded-xl p-4 text-sm text-white font-medium outline-none border border-white/5 focus:border-cyan-400"
                  />
                </div>

                <div class="space-y-2">
                  <label class="text-[10px] font-black uppercase tracking-widest text-cyan-400">Descripción (Edad, Acento, Timbre)</label>
                  <textarea 
                    id="textarea-voice-desc" 
                    rows="3" 
                    placeholder="Ej. Voz madura, tono grave, acento castellano dramático con misterio"
                    class="w-full bg-surface-container-high rounded-xl p-4 text-xs text-white font-medium outline-none border border-white/5 focus:border-cyan-400 resize-none"
                  >${newVoiceDescription}</textarea>
                </div>
              </div>

              <div class="pt-2">
                <button 
                  id="btn-confirm-create-voice" 
                  type="button"
                  class="w-full py-4 primary-gradient text-surface-dim font-black text-xs uppercase tracking-widest rounded-full shadow-lg shadow-cyan-400/20 active:scale-95 cursor-pointer"
                >
                  Registrar Voz en Estudio
                </button>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- ========================================== -->
        <!-- MODAL: PROGRAMAR PUBLICACIÓN (Calendario)  -->
        <!-- ========================================== -->
        ${showCalendarModal ? `
          <div class="fixed inset-0 z-[120] flex items-center justify-center p-6 pb-20">
            <div id="calendar-modal-backdrop" class="absolute inset-0 bg-black/85 backdrop-blur-md"></div>
            <div class="relative w-full max-w-sm bg-[#16181f] border border-white/10 rounded-[2.5rem] p-7 shadow-2xl space-y-6 text-center">
              
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-black text-cyan-400 uppercase tracking-[0.3em]">CALENDARIO DE ESTRENOS</span>
                <button id="btn-close-calendar" class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white cursor-pointer">
                  ${icon('x', { size: 16 })}
                </button>
              </div>

              <div class="space-y-1 text-left">
                <h3 class="text-xl font-black font-headline uppercase italic text-white">Programar Fecha</h3>
                <p class="text-xs text-on-surface-variant/70 font-medium">Selecciona el día en que tu episodio se publicará automáticamente.</p>
              </div>

              <div class="p-4 bg-surface-container-high/40 rounded-2xl border border-white/5 space-y-3">
                <input 
                  type="date" 
                  id="input-schedule-date"
                  class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-medium outline-none focus:border-cyan-400 cursor-pointer"
                />
              </div>

              <div class="flex gap-3 pt-2">
                <button id="btn-cancel-schedule" class="flex-1 py-4 bg-white/5 text-white/60 font-black text-xs uppercase tracking-widest rounded-full cursor-pointer">
                  Cancelar
                </button>
                <button id="btn-save-schedule" class="flex-1 py-4 primary-gradient text-surface-dim font-black text-xs uppercase tracking-widest rounded-full shadow-lg shadow-cyan-400/20 cursor-pointer">
                  Programar
                </button>
              </div>
            </div>
          </div>
        ` : ''}

      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    // Botón de Retroceso de la Barra Superior
    document.getElementById('btn-back-upload')?.addEventListener('click', () => {
      stopAudioPreview();
      window.location.hash = `#/creator/manage/${seriesId}`;
    });

    // Cambiador de Pestañas
    document.getElementById('btn-tab-upload')?.addEventListener('click', () => {
      audioType = 'upload';
      render();
    });

    document.getElementById('btn-tab-ai')?.addEventListener('click', () => {
      audioType = 'ai';
      // Si el usuario aún no ha editado el guion, mostrar el modal de opciones
      const hasContent = script.lineas.some(l => l.texto && l.texto.trim().length > 0);
      if (!hasContent) {
        showAiOptionsModal = true;
      }
      render();
    });

    // Abrir AI Studio desde la tarjeta
    document.getElementById('btn-open-ai-studio')?.addEventListener('click', () => {
      showAiVoiceScreen = true;
      render();
    });

    // Previsualización de Audio en la Tarjeta Principal
    document.getElementById('btn-preview-audio-main')?.addEventListener('click', () => {
      if (isPlayingPreview) stopAudioPreview();
      else startAudioPreview();
    });

    // Entrada de carga de archivo de audio
    document.getElementById('input-audio-file')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        audioError = null;
        audioFile = file;

        // Calcular duración y validar
        const tempAud = new Audio();
        tempAud.preload = 'metadata';
        const objUrl = URL.createObjectURL(file);
        tempAud.src = objUrl;

        tempAud.onloadedmetadata = () => {
          durationSeconds = Math.round(tempAud.duration || 0);
          if (durationSeconds > 15 * 60) {
            audioError = 'El audio supera los 15 minutos permitidos.';
            audioFile = null;
            audioDuration = '00:00';
          } else {
            const mins = Math.floor(durationSeconds / 60);
            const secs = durationSeconds % 60;
            audioDuration = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')} min`;
          }
          URL.revokeObjectURL(objUrl);
          render();
        };

        tempAud.onerror = () => {
          audioError = 'El archivo de audio no es válido o está dañado.';
          audioFile = null;
          audioDuration = '00:00';
          URL.revokeObjectURL(objUrl);
          render();
        };
      }
    });

    // Carga de imagen de portada
    document.getElementById('input-cover-file')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        coverImageFile = file;
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const opt = await optimizeImage(reader.result, 800, 800, 0.8);
            coverImagePreview = opt;
          } catch (_) {
            coverImagePreview = reader.result;
          }
          render();
        };
        reader.readAsDataURL(file);
      }
    });

    // Entradas de Título, Número y Descripción
    document.getElementById('input-ep-number')?.addEventListener('input', (e) => {
      number = e.target.value;
    });

    document.getElementById('input-ep-title')?.addEventListener('input', (e) => {
      title = e.target.value;
      const btn = document.getElementById('btn-publish-submit');
      if (btn) {
        const isValid = title.trim() !== '' && (audioType === 'upload' ? audioFile !== null : script.lineas.some(l => l.texto.trim().length > 0));
        btn.disabled = !isValid;
      }
    });

    document.getElementById('textarea-ep-desc')?.addEventListener('input', (e) => {
      description = e.target.value;
    });

    // Enviar Episodio
    document.getElementById('btn-publish-submit')?.addEventListener('click', () => {
      handlePublishEpisode('in_review');
    });

    // Disparadores del modal de programación
    document.getElementById('btn-open-schedule')?.addEventListener('click', () => {
      showCalendarModal = true;
      render();
    });

    document.getElementById('btn-close-calendar')?.addEventListener('click', () => {
      showCalendarModal = false;
      render();
    });

    document.getElementById('calendar-modal-backdrop')?.addEventListener('click', () => {
      showCalendarModal = false;
      render();
    });

    document.getElementById('btn-cancel-schedule')?.addEventListener('click', () => {
      showCalendarModal = false;
      render();
    });

    document.getElementById('btn-save-schedule')?.addEventListener('click', () => {
      const dateVal = document.getElementById('input-schedule-date')?.value;
      if (dateVal) {
        selectedDate = new Date(dateVal);
      }
      showCalendarModal = false;
      render();
    });

    // Eventos del Modal de Opciones de IA
    document.getElementById('btn-close-ai-options')?.addEventListener('click', () => {
      showAiOptionsModal = false;
      render();
    });

    document.getElementById('ai-options-backdrop')?.addEventListener('click', () => {
      showAiOptionsModal = false;
      render();
    });

    document.getElementById('btn-opt-full-ai')?.addEventListener('click', () => {
      showAiOptionsModal = false;
      showAiVoiceScreen = true;
      render();
    });

    document.getElementById('btn-opt-enhance-audio')?.addEventListener('click', () => {
      showAiOptionsModal = false;
      showEnhanceModal = true;
      render();
    });

    // Eventos del Modal de Mejora
    document.getElementById('btn-close-enhance')?.addEventListener('click', () => {
      showEnhanceModal = false;
      render();
    });

    document.getElementById('enhance-modal-backdrop')?.addEventListener('click', () => {
      showEnhanceModal = false;
      render();
    });

    container.querySelectorAll('[data-select-enhance]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedEnhanceAmbience = btn.getAttribute('data-select-enhance');
        render();
      });
    });

    document.getElementById('btn-apply-enhance')?.addEventListener('click', () => {
      showEnhanceModal = false;
      audioType = 'upload';
      alert(`¡Capa ambiental "${selectedEnhanceAmbience.toUpperCase()}" añadida a la mezcla de masterización del audio!`);
      render();
    });

    // Eventos del Estudio de Voz de IA a Pantalla Completa
    document.getElementById('btn-close-ai-screen')?.addEventListener('click', () => {
      stopAudioPreview();
      showAiVoiceScreen = false;
      render();
    });

    container.querySelectorAll('[data-script-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        script.modo = btn.getAttribute('data-script-mode');
        render();
      });
    });

    // Personajes en el estudio
    document.getElementById('btn-add-character')?.addEventListener('click', () => {
      const newId = 'c' + Date.now().toString();
      characters.push({
        id: newId,
        name: `Personaje ${characters.filter(c => !c.isNarrator).length + 1}`,
        voiceId: STANDARD_VOICES[0].id
      });
      render();
    });

    container.querySelectorAll('[data-remove-char]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-remove-char');
        characters = characters.filter(c => c.id !== id);
        render();
      });
    });

    container.querySelectorAll('[data-char-name]').forEach(input => {
      input.addEventListener('input', (e) => {
        const id = input.getAttribute('data-char-name');
        const char = characters.find(c => c.id === id);
        if (char) char.name = e.target.value;
      });
    });

    container.querySelectorAll('[data-char-voice]').forEach(select => {
      select.addEventListener('change', (e) => {
        const id = select.getAttribute('data-char-voice');
        const char = characters.find(c => c.id === id);
        if (char) char.voiceId = e.target.value;
      });
    });

    // Modal de voz personalizada en el estudio
    document.getElementById('btn-open-create-voice')?.addEventListener('click', () => {
      showCreateVoiceModal = true;
      render();
    });

    document.getElementById('btn-close-voice-modal')?.addEventListener('click', () => {
      showCreateVoiceModal = false;
      render();
    });

    document.getElementById('voice-modal-backdrop')?.addEventListener('click', () => {
      showCreateVoiceModal = false;
      render();
    });

    document.getElementById('input-voice-name')?.addEventListener('input', (e) => {
      newVoiceName = e.target.value;
    });

    document.getElementById('textarea-voice-desc')?.addEventListener('input', (e) => {
      newVoiceDescription = e.target.value;
    });

    document.getElementById('btn-confirm-create-voice')?.addEventListener('click', () => {
      if (!newVoiceName.trim()) {
        alert("Escribe el nombre de la voz.");
        return;
      }
      const customVoiceId = 'custom-' + Date.now().toString();
      STANDARD_VOICES.push({
        id: customVoiceId,
        name: `✨ ${newVoiceName.trim()} (Personalizada)`,
        lang: 'es-ES'
      });
      showCreateVoiceModal = false;
      newVoiceName = '';
      newVoiceDescription = '';
      alert("¡Nueva voz personalizada incorporada al catálogo del estudio!");
      render();
    });

    // Líneas de Diálogo en el Estudio
    document.getElementById('btn-add-line')?.addEventListener('click', () => {
      const defaultChar = characters.find(c => !c.isNarrator) || characters[0];
      script.lineas.push({
        id: Date.now().toString(),
        characterId: defaultChar.id,
        texto: '',
        efectoFondo: 'none',
        efectoLoop: false,
        solaparConAnterior: false
      });
      render();
    });

    document.getElementById('btn-add-sfx-line')?.addEventListener('click', () => {
      script.lineas.push({
        id: Date.now().toString(),
        characterId: 'narrador',
        texto: '[efecto ambiental continuo]',
        efectoFondo: 'suspenso',
        efectoLoop: true,
        solaparConAnterior: true
      });
      render();
    });

    container.querySelectorAll('[data-line-character]').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const id = sel.getAttribute('data-line-character');
        const line = script.lineas.find(l => l.id === id);
        if (line) line.characterId = e.target.value;
      });
    });

    container.querySelectorAll('[data-line-text]').forEach(ta => {
      ta.addEventListener('input', (e) => {
        const id = ta.getAttribute('data-line-text');
        const line = script.lineas.find(l => l.id === id);
        if (line) line.texto = e.target.value;
      });
    });

    container.querySelectorAll('[data-line-sfx]').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const id = sel.getAttribute('data-line-sfx');
        const line = script.lineas.find(l => l.id === id);
        if (line) line.efectoFondo = e.target.value;
      });
    });

    container.querySelectorAll('[data-line-loop]').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const id = chk.getAttribute('data-line-loop');
        const line = script.lineas.find(l => l.id === id);
        if (line) line.efectoLoop = e.target.checked;
      });
    });

    container.querySelectorAll('[data-toggle-overlap]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-toggle-overlap');
        const line = script.lineas.find(l => l.id === id);
        if (line) {
          line.solaparConAnterior = !line.solaparConAnterior;
          render();
        }
      });
    });

    container.querySelectorAll('[data-delete-line]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-delete-line');
        script.lineas = script.lineas.filter(l => l.id !== id);
        render();
      });
    });

    // Controles Inferiores del Estudio
    document.getElementById('btn-preview-script')?.addEventListener('click', () => {
      if (isPlayingPreview) stopAudioPreview();
      else startAudioPreview();
    });

    document.getElementById('btn-save-ai-script')?.addEventListener('click', handleSaveAiScript);
  }

  loadData();

  return () => {
    stopAudioPreview();
  };
}
