import './style.css';
import { createIcons, icons } from 'lucide';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="relative min-h-screen flex flex-col bg-gradient-radial overflow-hidden">
    <!-- Header -->
    <header class="fixed top-0 w-full z-50 glass border-b transition-all duration-300">
      <div class="container mx-auto px-6 h-16 flex items-center justify-between">
        <div class="flex items-center gap-2 group cursor-pointer">
          <div class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold shadow-sm transition-transform group-hover:scale-105">
            N
          </div>
          <span class="font-semibold text-lg tracking-tight">NextClaw</span>
        </div>
        <nav class="hidden md:flex gap-8 text-sm font-medium">
          <a href="#features" class="text-muted-foreground hover:text-foreground transition-colors">Features</a>
          <a href="https://github.com/Peiiii/nextclaw" target="_blank" class="text-muted-foreground hover:text-foreground transition-colors">GitHub</a>
          <a href="#" class="text-muted-foreground hover:text-foreground transition-colors">Docs</a>
        </nav>
        <div class="flex items-center gap-4">
          <a href="https://github.com/Peiiii/nextclaw" target="_blank" class="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-secondary">
            <i data-lucide="github" class="w-5 h-5"></i>
          </a>
        </div>
      </div>
    </header>

    <!-- Hero Section -->
    <main class="flex-1 flex flex-col items-center justify-center text-center px-6 pt-32 pb-20 z-10">
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-sm font-medium text-muted-foreground mb-8 animate-slide-up opacity-0" style="animation-delay: 0.1s">
        <span class="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
        v0.3.16 is now available
      </div>
      
      <h1 class="text-5xl md:text-7xl font-bold tracking-tight text-gradient max-w-4xl mb-6 animate-slide-up opacity-0" style="animation-delay: 0.2s">
        The effortlessly simple <br /> Personal AI Assistant.
      </h1>
      
      <p class="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 animate-slide-up opacity-0" style="animation-delay: 0.3s">
        Feature-rich, OpenClaw-compatible gateway. Multi-provider, multi-channel capabilities with an elegant zero-config interface. 
      </p>
      
      <div class="flex flex-col sm:flex-row gap-4 mb-16 animate-slide-up opacity-0" style="animation-delay: 0.4s">
        <div class="glass-card flex items-center pl-4 pr-1 py-1 rounded-full gap-3 transition-transform hover:scale-[1.02]">
          <span class="text-sm font-mono text-muted-foreground select-all">npm i -g nextclaw</span>
          <button id="copy-btn" class="bg-primary hover:bg-primary/90 text-white rounded-full p-2 w-10 h-10 flex items-center justify-center transition-colors focus:ring-2 focus:ring-primary focus:outline-none">
            <i data-lucide="copy" class="w-4 h-4"></i>
          </button>
        </div>
        <a href="https://github.com/Peiiii/nextclaw" target="_blank" class="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors shadow-sm focus:ring-2 focus:ring-foreground focus:outline-none">
          View on GitHub
        </a>
      </div>

      <!-- Hero Visual -->
      <div class="relative w-full max-w-5xl mx-auto animate-fade-in opacity-0" style="animation-delay: 0.6s">
        <div class="absolute inset-0 bg-primary/10 blur-[100px] rounded-full"></div>
        <div class="glass-card rounded-2xl overflow-hidden border border-border/50 shadow-2xl animate-float">
          <!-- Placeholder for actual screenshot or animated UI mock -->
          <div class="w-full aspect-[16/9] bg-secondary/50 flex flex-col">
            <!-- Mac window control -->
            <div class="h-10 border-b flex items-center px-4 gap-2 bg-background/50">
              <div class="w-3 h-3 rounded-full bg-red-400"></div>
              <div class="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div class="w-3 h-3 rounded-full bg-green-400"></div>
            </div>
            <!-- Mock Content -->
            <div class="flex-1 p-8 flex items-center justify-center">
              <div class="text-center space-y-4">
                 <div class="mx-auto w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center shadow-inner">
                    <i data-lucide="bot" class="w-8 h-8 text-primary"></i>
                 </div>
                 <h3 class="text-xl font-medium">NextClaw Config Interface</h3>
                 <p class="text-sm text-muted-foreground">Manage your AI seamlessly</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Features Section -->
    <section id="features" class="relative py-24 px-6 z-10 w-full max-w-7xl mx-auto">
      <div class="text-center mb-16 animate-slide-up opacity-0 relative" style="animation-delay: 0.1s">
        <h2 class="text-3xl md:text-5xl font-bold tracking-tight mb-4">Everything you need.</h2>
        <p class="text-muted-foreground text-lg max-w-2xl mx-auto">A powerful core wrapped in a seamless interface. Run NextClaw locally or expose it safely.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Feature 1 -->
        <div class="glass-card p-8 rounded-2xl hover:-translate-y-1 transition-transform duration-300 animate-slide-up opacity-0" style="animation-delay: 0.2s">
          <div class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary">
            <i data-lucide="layers" class="w-6 h-6"></i>
          </div>
          <h3 class="text-xl font-semibold mb-2">Zero-Config UI</h3>
          <p class="text-muted-foreground leading-relaxed">Manage your providers, models, and agents from an elegant dashboard. No hunting through JSON files.</p>
        </div>

        <!-- Feature 2 -->
        <div class="glass-card p-8 rounded-2xl hover:-translate-y-1 transition-transform duration-300 animate-slide-up opacity-0" style="animation-delay: 0.3s">
          <div class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary">
            <i data-lucide="cpu" class="w-6 h-6"></i>
          </div>
          <h3 class="text-xl font-semibold mb-2">Multi-Provider</h3>
          <p class="text-muted-foreground leading-relaxed">OpenRouter, OpenAI, vLLM, DeepSeek, MiniMax, and more. Easily switch between intelligent backends.</p>
        </div>

        <!-- Feature 3 -->
        <div class="glass-card p-8 rounded-2xl hover:-translate-y-1 transition-transform duration-300 animate-slide-up opacity-0" style="animation-delay: 0.4s">
          <div class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary">
            <i data-lucide="message-square" class="w-6 h-6"></i>
          </div>
          <h3 class="text-xl font-semibold mb-2">Multi-Channel</h3>
          <p class="text-muted-foreground leading-relaxed">Connect to Telegram, Discord, Feishu, Slack, and WhatsApp. Turn NextClaw into your omni-channel gateway.</p>
        </div>

        <!-- Feature 4 -->
        <div class="glass-card p-8 rounded-2xl hover:-translate-y-1 transition-transform duration-300 animate-slide-up opacity-0" style="animation-delay: 0.5s">
          <div class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary">
            <i data-lucide="blocks" class="w-6 h-6"></i>
          </div>
          <h3 class="text-xl font-semibold mb-2">OpenClaw Compatible</h3>
          <p class="text-muted-foreground leading-relaxed">Full compatibility with the OpenClaw plugin ecosystem. Bring your existing extensions without modifications.</p>
        </div>

        <!-- Feature 5 -->
        <div class="glass-card p-8 rounded-2xl hover:-translate-y-1 transition-transform duration-300 animate-slide-up opacity-0" style="animation-delay: 0.6s">
          <div class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary">
            <i data-lucide="clock" class="w-6 h-6"></i>
          </div>
          <h3 class="text-xl font-semibold mb-2">Automation Built-in</h3>
          <p class="text-muted-foreground leading-relaxed">Powerful Cron and Heartbeat systems allow your AI assistant to run scheduled autonomous tasks globally.</p>
        </div>

        <!-- Feature 6 -->
        <div class="glass-card p-8 rounded-2xl hover:-translate-y-1 transition-transform duration-300 animate-slide-up opacity-0" style="animation-delay: 0.7s">
          <div class="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 text-primary">
            <i data-lucide="zap" class="w-6 h-6"></i>
          </div>
          <h3 class="text-xl font-semibold mb-2">Local & Private</h3>
          <p class="text-muted-foreground leading-relaxed">Runs entirely on your machine. Keep your configurations, chat history, and tokens safe natively.</p>
        </div>
      </div>
    </section>

    <!-- Call to Action -->
    <section class="py-24 px-6 z-10 w-full max-w-4xl mx-auto text-center">
      <div class="glass-card rounded-[2rem] p-12 relative overflow-hidden">
        <div class="absolute inset-0 bg-primary/5"></div>
        <div class="relative z-10">
          <h2 class="text-3xl md:text-5xl font-bold mb-6">Ready to upgrade your AI?</h2>
          <p class="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">Get started with NextClaw in seconds. One command and your local gateway is fully operational.</p>
          <a href="https://github.com/Peiiii/nextclaw" target="_blank" class="inline-flex items-center justify-center gap-2 h-14 px-8 rounded-full font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-transform hover:scale-105 shadow-xl shadow-primary/20 focus:ring-2 focus:ring-primary focus:outline-none text-lg">
            View Documentation
            <i data-lucide="arrow-right" class="w-5 h-5 ml-1"></i>
          </a>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="w-full border-t border-border/40 py-10 z-10 bg-background/50 backdrop-blur-sm mt-auto">
      <div class="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div class="flex items-center gap-2 opacity-80">
          <div class="w-6 h-6 rounded bg-foreground flex items-center justify-center text-background font-bold text-xs">N</div>
          <span class="font-medium text-sm">NextClaw Project</span>
        </div>
        <div class="text-sm text-muted-foreground">
          Released under the MIT License.
        </div>
        <div class="flex gap-4">
          <a href="https://github.com/Peiiii/nextclaw" target="_blank" class="text-muted-foreground hover:text-foreground transition-colors">GitHub</a>
          <a href="https://www.npmjs.com/package/nextclaw" target="_blank" class="text-muted-foreground hover:text-foreground transition-colors">NPM</a>
        </div>
      </div>
    </footer>
    
    <!-- Decorative background elements -->
    <div class="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
      <div class="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]"></div>
      <div class="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[150px]"></div>
    </div>
  </div>
`;

// Initialize Lucide icons
createIcons({
  icons,
  nameAttr: 'data-lucide'
});

// Copy functionality
const copyBtn = document.getElementById('copy-btn');
if (copyBtn) {
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText('npm i -g nextclaw');

      // Visual feedback
      const originalIcon = copyBtn.innerHTML;
      copyBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i>';
      createIcons({ icons, nameAttr: 'data-lucide' });
      copyBtn.classList.add('bg-green-500');

      setTimeout(() => {
        copyBtn.innerHTML = originalIcon;
        createIcons({ icons, nameAttr: 'data-lucide' });
        copyBtn.classList.remove('bg-green-500');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  });
}
