import { icon } from '../icons.js';

export function renderFinances(container) {
  const historyItems = [
    {
      id: 1,
      title: 'Regalías de Stream',
      subtitle: 'Podcast: El Futuro Digital',
      amount: '+$45.000',
      time: 'HACE 2 HORAS',
      type: 'income',
      iconName: 'play'
    },
    {
      id: 2,
      title: 'Nueva Suscripción Premium',
      subtitle: 'Usuario: @neotech_88',
      amount: '+$25.000',
      time: 'AYER',
      type: 'income',
      iconName: 'users'
    },
    {
      id: 3,
      title: 'Retiro a Cuenta Bancaria',
      subtitle: 'Banco: Bancolombia',
      amount: '-$200.000',
      time: '12 ABR',
      type: 'withdrawal',
      iconName: 'arrow-up-right'
    }
  ];

  container.innerHTML = `
    <div class="min-h-screen bg-surface-dim pb-32">
      <div class="px-6 pt-10 space-y-12">
        <!-- Main Title Section -->
        <div class="space-y-1 text-center">
          <p class="text-[10px] font-black text-cyan-400 uppercase tracking-[0.4em] mb-1">
            CONTROL DE INGRESOS
          </p>
          <h1 class="text-[35px] font-black font-headline tracking-tighter uppercase italic leading-[32.6px]">
            Finanzas del<br />Creador
          </h1>
        </div>

        <!-- Total Earnings Card -->
        <section class="bg-[#1c1d21]/80 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/[0.03] shadow-2xl relative overflow-hidden">
          <div class="flex items-center justify-between mb-8">
            <div class="flex items-center gap-2 text-on-surface-variant font-bold text-[13px] tracking-wide">
              <div class="w-5 h-5 rounded bg-surface-container-highest/50 flex items-center justify-center">
                ${icon('wallet', { size: 12, className: 'text-on-surface-variant' })}
              </div>
              Ganancias Totales
            </div>
            <div class="bg-[#1e3a3a] text-[#4dd0e1] text-[9px] font-black px-2.5 py-1 rounded-md tracking-wider uppercase">
              Acumulado
            </div>
          </div>

          <div class="space-y-1">
            <h2 class="text-[44px] leading-tight font-black font-headline text-white tracking-tight">
              $1.578.900
            </h2>
            <div class="space-y-4">
              <span class="text-on-surface-variant font-bold text-lg block">COP</span>
              <div class="flex items-center gap-1.5 text-primary brightness-125">
                ${icon('trending-up', { size: 16 })}
                <span class="text-[12px] font-black uppercase tracking-widest">+12.5% este mes</span>
              </div>
            </div>
          </div>

          <div class="mt-8 pt-8 border-t border-white/[0.05] grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <p class="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.1em] opacity-60 leading-tight">
                Comisión App<br />(5%)
              </p>
              <p class="text-[13px] font-bold text-white">-$78.945 COP</p>
            </div>
            <div class="space-y-1">
              <p class="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.1em] opacity-60 leading-tight">
                Impuestos<br />Locales
              </p>
              <p class="text-[13px] font-bold text-white">-$15.200 COP</p>
            </div>
          </div>
        </section>

        <!-- Available Balance Card -->
        <section class="bg-gradient-to-br from-[#4FC3F7] to-[#1A73E8] rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(26,115,232,0.3)] relative group">
          <div class="absolute top-0 right-0 p-6 opacity-20 pointer-events-none text-white">
            ${icon('wallet', { size: 120, strokeWidth: 0.5 })}
          </div>
          
          <div class="inline-flex items-center bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full mb-6">
            <span class="text-[#0D47A1] text-[9px] font-black tracking-widest uppercase">Saldo Disponible</span>
          </div>

          <div class="space-y-1 mb-8">
            <h3 class="text-4xl font-black font-headline text-[#0D47A1] tracking-tight">
              $1.484.755
            </h3>
            <p class="text-[#0D47A1]/60 text-xs font-bold">Listo para retirar</p>
          </div>

          <button id="btn-withdraw-funds" class="w-full h-16 bg-[#0a0a0a] text-white flex items-center justify-center gap-3 rounded-2xl font-black uppercase tracking-wider text-sm active:scale-[0.98] transition-transform shadow-xl cursor-pointer">
            <div class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              ${icon('wallet', { size: 18, className: 'text-primary brightness-150' })}
            </div>
            Retirar Fondos
          </button>
        </section>

        <!-- Monthly Performance Chart -->
        <section class="bg-[#1c1d21]/40 rounded-[2.5rem] p-8 border border-white/[0.03]">
          <div class="flex items-center justify-between mb-10">
            <h3 class="text-xl font-black font-headline text-white leading-tight">
              Rendimiento<br />Mensual
            </h3>
            <div class="flex bg-surface-dim/80 p-1 rounded-xl">
              <button class="px-4 py-2 text-[10px] font-black bg-surface-container-high text-white rounded-lg uppercase tracking-wider shadow-sm">30D</button>
              <button class="px-4 py-2 text-[10px] font-black text-on-surface-variant opacity-60 uppercase tracking-wider">90D</button>
            </div>
          </div>

          <div class="flex items-end justify-between h-48 px-1 relative">
            <div class="flex flex-col items-center gap-3 h-full justify-end">
              <div class="w-8 rounded-2xl bg-white/5" style="height: 40%;"></div>
              <span class="text-[10px] font-black text-on-surface-variant/40">ENE</span>
            </div>
            <div class="flex flex-col items-center gap-3 h-full justify-end">
              <div class="w-8 rounded-2xl bg-white/5" style="height: 65%;"></div>
              <span class="text-[10px] font-black text-on-surface-variant/40">FEB</span>
            </div>
            <div class="flex flex-col items-center gap-3 h-full justify-end">
              <div class="w-8 rounded-2xl bg-white/5" style="height: 50%;"></div>
              <span class="text-[10px] font-black text-on-surface-variant/40">MAR</span>
            </div>
            <div class="flex flex-col items-center gap-3 h-full justify-end relative">
              <span class="absolute -top-7 text-[9px] font-black bg-primary text-surface-dim px-2 py-0.5 rounded-full shadow-lg">$250k</span>
              <div class="w-8 rounded-2xl bg-gradient-to-t from-primary to-cyan-300 shadow-[0_0_15px_rgba(0,229,255,0.4)]" style="height: 80%;"></div>
              <span class="text-[10px] font-black text-primary">ABR</span>
            </div>
            <div class="flex flex-col items-center gap-3 h-full justify-end">
              <div class="w-8 rounded-2xl bg-white/5" style="height: 60%;"></div>
              <span class="text-[10px] font-black text-on-surface-variant/40">MAY</span>
            </div>
            <div class="flex flex-col items-center gap-3 h-full justify-end">
              <div class="w-8 rounded-2xl bg-white/5" style="height: 55%;"></div>
              <span class="text-[10px] font-black text-on-surface-variant/40">JUN</span>
            </div>
          </div>
        </section>

        <!-- Recent History -->
        <section class="space-y-6 pb-4">
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-black font-headline text-white">Historial Reciente</h3>
            <button class="text-primary text-[11px] font-black uppercase tracking-widest hover:brightness-125 cursor-pointer">Ver Todo</button>
          </div>

          <div class="space-y-4">
            ${historyItems.map(item => `
              <div class="flex items-center justify-between p-4 bg-[#1c1d21]/60 rounded-3xl border border-white/[0.02] active:bg-white/[0.02] transition-colors">
                <div class="flex items-center gap-4">
                  <div class="w-12 h-12 rounded-full flex items-center justify-center ${
                    item.type === 'income' ? 'bg-[#4dd0e1]/10 text-[#4dd0e1]' : 'bg-red-500/10 text-red-500'
                  }">
                    ${icon(item.iconName, { size: 18, fill: item.iconName === 'play' ? 'currentColor' : 'none' })}
                  </div>
                  <div>
                    <h4 class="text-sm font-black text-white leading-tight">${item.title}</h4>
                    <p class="text-[11px] text-on-surface-variant font-medium mt-0.5">${item.subtitle}</p>
                  </div>
                </div>
                <div class="text-right">
                  <p class="text-sm font-black ${
                    item.type === 'income' ? 'text-[#4dd0e1]' : 'text-red-500'
                  }">${item.amount}</p>
                  <p class="text-[9px] font-black text-on-surface-variant/40 mt-0.5 tracking-tighter">${item.time}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </section>
      </div>
    </div>
  `;

  document.getElementById('btn-withdraw-funds')?.addEventListener('click', () => {
    alert('Retiro bancario solicitado con éxito hacia tu cuenta bancaria registrada.');
  });
}
