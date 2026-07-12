export class PanelManager {
  private container: HTMLDivElement;
  private overlay: HTMLDivElement;
  private activePanel: HTMLDivElement | null = null;

  constructor() {
    const gameContainer = document.getElementById('game-container')!;

    this.overlay = document.createElement('div');
    this.overlay.id = 'panel-overlay';
    this.overlay.style.cssText =
      'position:absolute;top:0;left:0;right:0;bottom:0;' +
      'background:rgba(0,0,0,0.5);z-index:500;display:none;' +
      'justify-content:center;align-items:center;';
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.closeActive();
    });
    gameContainer.appendChild(this.overlay);

    this.container = document.createElement('div');
    this.container.id = 'panel-container';
    this.container.style.cssText =
      'position:absolute;top:0;left:0;right:0;bottom:0;' +
      'z-index:501;pointer-events:none;';
    gameContainer.appendChild(this.container);
  }

  private closeActive(): void {
    this.overlay.style.display = 'none';
    if (this.activePanel) {
      this.activePanel.remove();
      this.activePanel = null;
    }
  }

  private showPanel(content: string, title: string): void {
    this.closeActive();

    this.activePanel = document.createElement('div');
    this.activePanel.style.cssText =
      'background:#1a1a2e;border:2px solid #445577;border-radius:8px;' +
      'padding:20px;min-width:300px;max-width:500px;max-height:70vh;' +
      'overflow-y:auto;pointer-events:auto;' +
      'font-family:"Courier New",monospace;font-size:12px;color:#e0e0e0;';

    const titleEl = document.createElement('h3');
    titleEl.textContent = title;
    titleEl.style.cssText = 'margin:0 0 12px 0;color:#ffcc00;font-size:14px;';
    this.activePanel.appendChild(titleEl);

    const body = document.createElement('div');
    body.innerHTML = content;
    this.activePanel.appendChild(body);

    this.container.appendChild(this.activePanel);
    this.overlay.style.display = 'flex';
  }

  showTechTree(): void {
    this.showPanel(
      '<p style="color:#888;">Tech tree details coming soon.</p>',
      'Tech Tree',
    );
  }

  destroy(): void {
    this.closeActive();
    this.container.remove();
    this.overlay.remove();
  }
}
