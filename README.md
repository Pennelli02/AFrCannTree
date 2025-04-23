# 3D Interaction System for A-Frame and Three.js


Un sistema completo per l'interazione con oggetti 3D in ambienti WebGL, progettato per integrazione con A-Frame, Three.js e backend C# Blazor.

⚙️ Funzionalità principali
1. Drag-Rotate-Collision System (physics-manager.js)
Manipolazione avanzata di oggetti 3D con trascinamento, rotazione e ridimensionamento

  - Sistema di fisica integrato con CANNON.js per collisioni realistiche

  - Gestione di gruppi di oggetti con trasformazioni coordinate

  - Controllo dei limiti spaziali e rilevamento collisioni

  - Analisi di stabilità per oggetti impilati

2. Bounded Drag Controls (drag-boundary-system.js)
 - Trascinamento vincolato con limiti configurabili

 - Integrazione diretta con A-Frame e Three.js

 - Comunicazione bidirezionale con backend C#

 - Feedback visivo durante l'interazione

 - Dimensioni dinamiche modificabili a runtime

🔧 Prerequisiti
```html
<!-- Librerie richieste -->
<script src="https://aframe.io/releases/1.5.0/aframe.min.js"></script>
<script src="https://unpkg.com/aframe-orbit-controls@1.3.2/dist/aframe-orbit-controls.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/cannon.js/0.6.2/cannon.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.135.0/examples/js/controls/DragControls.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.135.0/examples/js/controls/OrbitControls.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.135.0/examples/js/controls/TransformControls.js"></script>

<!-- Per il sistema fisico avanzato -->
<script src="physics-manager.js"></script>

<!-- Per i controlli di trascinamento vincolato -->
<script src="drag-boundary-system.js"></script>
```
🧠 Configurazione comune
```js

const ATHREE = AFRAME.THREE; //Variabili per Drag-Rotate-Collision System
```
```js
//Variabili per Bounded Drag Controls
let scene, camera, box, container, renderer, controls; 
let drag, actualCamera, Ascene;
let dotNet;
let isDragEnabled = true;
```
🚀 Inizializzazione
Drag-Rotate-Collision System
```js
const physicsSystem = DragRotateCollision(
  containerLength, 
  containerWidth, 
  containerHeight, 
  colliderIds, 
  dotNetHelper
);
```
Bounded Drag Controls
```js
activateDrag(
  initialX, initialY, initialZ,
  objectLength, objectHeight, objectWidth,
  limitX, limitY, limitZ,
  dotNetHelper
);
```
🧾 Parametri richiesti
physics-manager.js:
  - Tlength, TWidth, THeight: Dimensioni dello spazio contenitore

  - ColliId: Array di ID degli oggetti A-Frame da gestire

  - dotNetHelper: Oggetto C# per la comunicazione Blazor

drag-boundary-system.js
  - x, y, z: Posizione iniziale dell’oggetto

  - length, height, width: Dimensioni dell’oggetto

  - limitX, limitY, limitZ: Limiti dello spazio di movimento

  - dotNetHelper: Oggetto C# per la comunicazione Blazor

🔁 Integrazione con Blazor
Comunicazione tramite dotNetHelper da/verso C#:

```csharp

[JSInvokable]
public void OnObjectSelected(string objectId)
{
    // Logica quando un oggetto viene selezionato
}

[JSInvokable]
public void UpdateSpacePosition(double x, double y, double z)
{
    // Aggiorna la posizione nello stato dell'applicazione
}
```
📦 Metodi esposti
Drag-Rotate-Collision System
  - togglePhysics(): Attiva/disattiva la simulazione fisica

  - toggleGroupMode(): Attiva la selezione multipla

  - checkStability(): Verifica la stabilità degli oggetti impilati

Bounded Drag Controls
  - setDragEnabled(bool): Abilita/disabilita il trascinamento

  - setNewDimensions(length, height, width): Aggiorna le dimensioni a runtime

🧪 Esempi d'uso
 ```js 
 // Inizializza il sistema di fisica per la gestione dei colli nel vano di carico
const logisticsSystem = DragRotateCollision( 13.6, // Lunghezza vano camion (metri)
2.55, // Larghezza vano camion
2.7, // Altezza vano camion
['#collo1', '#collo2', '#collo3'], // ID degli oggetti da gestire
dotNetHelper // Collegamento con backend Blazor );
// Inizializza i controlli per trascinamento con limiti definiti nello spazio 3D
activateDrag(
0, 0, 0, // Posizione iniziale dell'oggetto
2, 1, 1.5, // Dimensioni dell'oggetto (L x H x P)
10, 3, 5, // Limiti di movimento nello spazio
dotNetHelper // Collegamento con backend Blazor );
``` 
🛠️ Autori & Manutenzione
Questo progetto è progettato per essere estendibile e adattabile in ambienti WebXR, simulazioni logistiche e configuratori 3D.
Per segnalare problemi o proporre miglioramenti, apri una issue o una pull request su GitHub.
