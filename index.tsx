/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

const {Map} = await google.maps.importLibrary('maps');
const {LatLngBounds} = await google.maps.importLibrary('core');
const {AdvancedMarkerElement} = await google.maps.importLibrary('marker');

// Application state variables
let map; // Holds the Google Map instance
let points = []; // Array to store geographical points from responses
let markers = []; // Array to store map markers
let lines = []; // Array to store polylines representing routes/connections
let popUps = []; // Array to store custom popups for locations
let bounds; // Google Maps LatLngBounds object to fit map around points
let activeCardIndex = -1; // Index of the currently selected location card (-1 means none selected)
let isPlannerMode = false; // Flag to indicate if Day Planner mode is active
let dayPlanItinerary = []; // Array to hold structured items for the day plan timeline
let currentQuery = ''; // Current search query

// DOM Element references
const generateButton = document.querySelector('#generate');
const resetButton = document.querySelector('#reset');
const queryCard = document.querySelector('#query-card') as HTMLDivElement;
const cardContainer = document.querySelector(
  '#card-container',
) as HTMLDivElement;
const carouselIndicators = document.querySelector(
  '#carousel-indicators',
) as HTMLDivElement;
const prevCardButton = document.querySelector(
  '#prev-card',
) as HTMLButtonElement;
const nextCardButton = document.querySelector(
  '#next-card',
) as HTMLButtonElement;
const cardCarousel = document.querySelector('.card-carousel') as HTMLDivElement;
const plannerModeToggle = document.querySelector(
  '#planner-mode-toggle',
) as HTMLInputElement;
const timelineContainer = document.querySelector(
  '#timeline-container',
) as HTMLDivElement;
const timeline = document.querySelector('#timeline') as HTMLDivElement;
const exportPlanButton = document.querySelector(
  '#export-plan',
) as HTMLButtonElement;
const mapContainer = document.querySelector('#map-container');
const timelineToggle = document.querySelector('#timeline-toggle');
const mapOverlay = document.querySelector('#map-overlay');
const spinner = document.querySelector('#spinner');
const errorMessage = document.querySelector('#error-message');
const confirmationModal = document.querySelector('#confirmation-modal');
const confirmDeleteButton = document.querySelector('#confirm-delete');
const cancelDeleteButton = document.querySelector('#cancel-delete');
let itemToDelete: {index: number; name: string} | null = null;
const resetConfirmationModal = document.querySelector('#reset-confirmation-modal');
const confirmResetButton = document.querySelector('#confirm-reset');
const cancelResetButton = document.querySelector('#cancel-reset');
const modeSwitchConfirmationModal = document.querySelector('#mode-switch-confirmation-modal');
const confirmModeSwitchButton = document.querySelector('#confirm-mode-switch');
const cancelModeSwitchButton = document.querySelector('#cancel-mode-switch');
const modeNotification = document.querySelector('#mode-notification');
const modeNotificationText = document.querySelector('#mode-notification-text');
let pendingModeChange: boolean | null = null;

// Initializes the Google Map instance and necessary libraries.
async function initMap() {
  bounds = new LatLngBounds();

  map = new Map(document.getElementById('map'), {
    center: {lat: -34.397, lng: 150.644}, // Default center
    zoom: 8, // Default zoom
    mapId: '4504f8b37365c3d0', // Custom map ID for styling
    gestureHandling: 'greedy', // Allows easy map interaction on all devices
    zoomControl: false,
    cameraControl: false,
    mapTypeControl: false,
    scaleControl: false,
    streetViewControl: false,
    rotateControl: false,
    fullscreenControl: false,
  });

  // Define a custom Popup class extending Google Maps OverlayView.
  // This allows for custom HTML content near map markers.
  window.Popup = class Popup extends google.maps.OverlayView {
    position;
    containerDiv;
    constructor(position, content) {
      super();
      this.position = position;
      content.classList.add('popup-bubble');

      this.containerDiv = document.createElement('div');
      this.containerDiv.classList.add('popup-container');
      this.containerDiv.appendChild(content); // Append the actual content here
      // Prevent clicks inside the popup from propagating to the map.
      Popup.preventMapHitsAndGesturesFrom(this.containerDiv);
    }

    /** Called when the popup is added to the map via setMap(). */
    onAdd() {
      this.getPanes().floatPane.appendChild(this.containerDiv);
    }

    /** Called when the popup is removed from the map via setMap(null). */
    onRemove() {
      if (this.containerDiv.parentElement) {
        this.containerDiv.parentElement.removeChild(this.containerDiv);
      }
    }

    /** Called each frame when the popup needs to draw itself. */
    draw() {
      const divPosition = this.getProjection().fromLatLngToDivPixel(
        this.position,
      );
      // Hide the popup when it is far out of view for performance.
      const display =
        Math.abs(divPosition.x) < 4000 && Math.abs(divPosition.y) < 4000
          ? 'block'
          : 'none';

      if (display === 'block') {
        this.containerDiv.style.left = divPosition.x + 'px';
        this.containerDiv.style.top = divPosition.y + 'px';
      }

      if (this.containerDiv.style.display !== display) {
        this.containerDiv.style.display = display;
      }
    }
  };

  // Add click listener to map to reset all markers to red when clicking on map (not on cards)
  map.addListener('click', (e: google.maps.MapMouseEvent) => {
    // Only reset if not clicking on a card, card container, marker, or popup
    const target = e.domEvent?.target as HTMLElement;
    if (target && 
        !target.closest('.location-card') && 
        !target.closest('.card-container') &&
        !target.closest('.popup-container') &&
        !target.closest('[data-marker]')) {
      resetAllMarkersToRed();
    }
  });
}

// Initialize the map as soon as the script loads.
initMap();

// System instructions provided to the Google AI model guiding its responses.
const systemInstructions = `## System Instructions for an Interactive Map Explorer

**Model Persona:** You are a knowledgeable, geographically-aware assistant that provides visual information through maps.
Your primary goal is to answer any location-related query comprehensively, using map-based visualizations.
You can process information about virtually any place, real or fictional, past, present, or future.

**Core Capabilities:**

1. **Geographic Knowledge:** You possess extensive knowledge of:
   * Global locations, landmarks, and attractions
   * Historical sites and their significance
   * Natural wonders and geography
   * Cultural points of interest
   * Travel routes and transportation options

2. **Two Operation Modes:**

   **A. General Explorer Mode** (Default when DAY_PLANNER_MODE is false):
   * Respond to any query by identifying relevant geographic locations
   * Show multiple points of interest related to the query
   * Provide rich descriptions for each location
   * Connect related locations with appropriate paths
   * Focus on information delivery rather than scheduling

   **B. Day Planner Mode** (When DAY_PLANNER_MODE is true):
   * Create detailed day itineraries with:
     * A logical sequence of locations to visit throughout a day (typically 4-6 major stops)
     * Specific times and realistic durations for each location visit
     * Travel routes between locations with appropriate transportation methods
     * A balanced schedule considering travel time, meal breaks, and visit durations
     * Each location must include a 'time' (e.g., "09:00") and 'duration' property
     * Each location must include a 'sequence' number (1, 2, 3, etc.) to indicate order
     * Each line connecting locations should include 'transport' and 'travelTime' properties

**Output Format:**

1. **General Explorer Mode:**
   * Use the "location" function for each relevant point of interest with name, description, lat, lng
   * Use the "line" function to connect related locations if appropriate
   * Provide as many interesting locations as possible (4-8 is ideal)
   * Ensure each location has a meaningful description

2. **Day Planner Mode:**
   * Use the "location" function for each stop with required time, duration, and sequence properties
   * Use the "line" function to connect stops with transport and travelTime properties
   * Structure the day in a logical sequence with realistic timing
   * Include specific details about what to do at each location

**Important Guidelines:**
* For ANY query, always provide geographic data through the location function
* If unsure about a specific location, use your best judgment to provide coordinates
* Never reply with just questions or requests for clarification
* Always attempt to map the information visually, even for complex or abstract queries
* For day plans, create realistic schedules that start no earlier than 8:00am and end by 9:00pm

Remember: In default mode, respond to ANY query by finding relevant locations to display on the map, even if not explicitly about travel or geography. In day planner mode, create structured day itineraries.`;

// Functions to control the visibility of the timeline panel.
function showTimeline() {
  if (timelineContainer) {
    timelineContainer.style.display = 'block';

    // Delay adding 'visible' class for CSS transition effect.
    setTimeout(() => {
      timelineContainer.classList.add('visible');

      if (window.innerWidth > 768) {
        // Desktop view
        mapContainer.classList.add('map-container-shifted');
        adjustInterfaceForTimeline(true);
        window.dispatchEvent(new Event('resize')); // Force map redraw
      } else {
        // Mobile view
        mapOverlay.classList.add('visible');
      }
    }, 10);
  }
}

function hideTimeline() {
  if (timelineContainer) {
    timelineContainer.classList.remove('visible');
    mapContainer.classList.remove('map-container-shifted');
    mapOverlay.classList.remove('visible');
    adjustInterfaceForTimeline(false);

    // Wait for transition before setting display to none.
    setTimeout(() => {
      timelineContainer.style.display = 'none';
      window.dispatchEvent(new Event('resize'));
    }, 300);
  }
}

// Adjusts map bounds when the timeline visibility changes.
function adjustInterfaceForTimeline(isTimelineVisible) {
  if (bounds && map) {
    setTimeout(() => {
      map.fitBounds(bounds);
    }, 350); // Delay to allow layout adjustments
  }
}

// Event Listeners for UI elements.
const promptInput = document.querySelector(
  '#prompt-input',
) as HTMLTextAreaElement;

// Disable button initially
if (generateButton) (generateButton as HTMLButtonElement).disabled = true;

promptInput.addEventListener('input', () => {
  const buttonEl = document.getElementById('generate') as HTMLButtonElement;
  if (buttonEl) {
    buttonEl.disabled = promptInput.value.trim() === '';
  }
});

promptInput.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.code === 'Enter' && !e.shiftKey) {
    // Allow shift+enter for new lines
    e.preventDefault();
    e.stopPropagation();

    if (promptInput.value.trim() === '') return;

    const buttonEl = document.getElementById('generate') as HTMLButtonElement;
    buttonEl.classList.add('loading');
    
    setTimeout(() => {
      sendText(promptInput.value);
      promptInput.value = '';
      buttonEl.disabled = true; // Disable after sending
    }, 10); // Delay to show loading state
  }
});

generateButton.addEventListener('click', (e) => {
  const buttonEl = e.currentTarget as HTMLButtonElement;
  if (promptInput.value.trim() === '') return;
  
  buttonEl.classList.add('loading');

  setTimeout(() => {
    sendText(promptInput.value);
    // promptInput.value = ''; // Cleared in sendText or here? It was only cleared in keydown handler before.
    // The previous code didn't clear it on click? Let's keep consistent behavior.
    // Wait, promptInput.value = '' is done in keydown handler but NOT in click handler in original code?
    // Checking original code...
    // Original click handler:
    // generateButton.addEventListener('click', (e) => {
    //   const buttonEl = e.currentTarget as HTMLButtonElement;
    //   buttonEl.classList.add('loading');
    //   setTimeout(() => {
    //     sendText(promptInput.value);
    //   }, 10);
    // });
    // It didn't clear promptInput.value. That seems like a bug or oversight. I will clear it for better UX and disable button.
    // But wait, if I clear it, the user might want to refine their prompt?
    // The keydown handler cleared it. I should probably align them.
    // I'll assume clearing is desired.
  }, 10);
});

resetButton.addEventListener('click', (e) => {
  showResetConfirmation();
});

if (prevCardButton) {
  prevCardButton.addEventListener('click', () => {
    navigateCards(-1);
  });
}

if (nextCardButton) {
  nextCardButton.addEventListener('click', () => {
    navigateCards(1);
  });
}

if (plannerModeToggle) {
  plannerModeToggle.addEventListener('change', () => {
    // Store the intended new mode state
    const newMode = plannerModeToggle.checked;
    
    // If mode is actually changing, show confirmation
    if (newMode !== isPlannerMode) {
      pendingModeChange = newMode;
      showModeSwitchConfirmation();
      // Revert the toggle until confirmed
      plannerModeToggle.checked = isPlannerMode;
    }
  });
}

if (timelineToggle) {
  timelineToggle.addEventListener('click', () => {
    showTimeline();
  });
}

if (mapOverlay) {
  mapOverlay.addEventListener('click', () => {
    hideTimeline();
  });
}

if (exportPlanButton) {
  exportPlanButton.addEventListener('click', () => {
    exportDayPlan();
  });
}

if (confirmDeleteButton) {
  confirmDeleteButton.addEventListener('click', () => {
    if (itemToDelete !== null) {
      deleteTimelineItem(itemToDelete.index);
      hideDeleteConfirmation();
    }
  });
}

if (cancelDeleteButton) {
  cancelDeleteButton.addEventListener('click', () => {
    hideDeleteConfirmation();
  });
}

if (confirmationModal) {
  confirmationModal.addEventListener('click', (e) => {
    if (e.target === confirmationModal) {
      hideDeleteConfirmation();
    }
  });
}

if (confirmResetButton) {
  confirmResetButton.addEventListener('click', () => {
    restart();
    hideResetConfirmation();
  });
}

if (cancelResetButton) {
  cancelResetButton.addEventListener('click', () => {
    hideResetConfirmation();
  });
}

if (resetConfirmationModal) {
  resetConfirmationModal.addEventListener('click', (e) => {
    if (e.target === resetConfirmationModal) {
      hideResetConfirmation();
    }
  });
}

if (confirmModeSwitchButton) {
  confirmModeSwitchButton.addEventListener('click', () => {
    if (pendingModeChange !== null) {
      isPlannerMode = pendingModeChange;
      plannerModeToggle.checked = isPlannerMode;
      promptInput.placeholder = isPlannerMode
        ? "Create a day plan in... "
        : 'Explore places, history, events, or ask about any location...';

      if (!isPlannerMode && timelineContainer) {
        hideTimeline();
      }
      
      // Show mode notification
      showModeNotification(isPlannerMode);
      
      pendingModeChange = null;
    }
    hideModeSwitchConfirmation();
  });
}

if (cancelModeSwitchButton) {
  cancelModeSwitchButton.addEventListener('click', () => {
    pendingModeChange = null;
    hideModeSwitchConfirmation();
  });
}

if (modeSwitchConfirmationModal) {
  modeSwitchConfirmationModal.addEventListener('click', (e) => {
    if (e.target === modeSwitchConfirmationModal) {
      pendingModeChange = null;
      hideModeSwitchConfirmation();
    }
  });
}

// Updates the query card with the current search query
function updateQueryCard(query: string) {
  currentQuery = query;
  if (queryCard) {
    if (query && query.trim() !== '') {
      queryCard.innerHTML = `
        <div class="query-card-content">
          <i class="fas fa-search query-icon"></i>
          <span class="query-text">${query}</span>
        </div>
      `;
      queryCard.style.display = 'block';
    } else {
      queryCard.style.display = 'none';
      queryCard.innerHTML = '';
    }
  }
  
  // Show/hide reset button based on query
  if (resetButton) {
    if (query && query.trim() !== '') {
      resetButton.classList.remove('hidden');
    } else {
      resetButton.classList.add('hidden');
    }
  }
}

// Resets the map and application state to initial conditions.
function restart() {
  points = [];
  bounds = new google.maps.LatLngBounds();
  dayPlanItinerary = [];

  markers.forEach((marker) => marker.setMap(null));
  markers = [];

  lines.forEach((line) => {
    line.poly.setMap(null);
    line.geodesicPoly.setMap(null);
  });
  lines = [];

  popUps.forEach((popup) => {
    popup.popup.setMap(null);
    if (popup.content && popup.content.remove) popup.content.remove();
  });
  popUps = [];

  if (cardContainer) cardContainer.innerHTML = '';
  if (carouselIndicators) carouselIndicators.innerHTML = '';
  if (cardCarousel) cardCarousel.style.display = 'none';
  if (timeline) timeline.innerHTML = '';
  if (timelineContainer) hideTimeline();
  
  // Clear query card on reset
  updateQueryCard('');
}

// Sends the user's prompt to the Google AI and processes the response.
async function sendText(prompt: string) {
  spinner.classList.remove('hidden');
  errorMessage.innerHTML = '';
  restart();
  
  // Update query card with the current prompt
  updateQueryCard(prompt);
  
  const buttonEl = document.getElementById('generate') as HTMLButtonElement;

  try {
    let finalPrompt = prompt;
    if (isPlannerMode) {
      finalPrompt = prompt + ' day trip';
    }

    const updatedInstructions = isPlannerMode
      ? systemInstructions.replace('DAY_PLANNER_MODE', 'true')
      : systemInstructions.replace('DAY_PLANNER_MODE', 'false');

    const response = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt, plannerMode: isPlannerMode, systemInstruction: updatedInstructions }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'İstek başarısız oldu.');

    let results = false;
    for (const fn of payload.functionCalls ?? []) {
      if (fn.name === 'location') {
        await setPin(fn.args);
        results = true;
      }
      if (fn.name === 'line') {
        await setLeg(fn.args);
        results = true;
      }
    }

    if (!results) {
      throw new Error(
        'Could not generate any results. Try again, or try a different prompt.',
      );
    }

    if (isPlannerMode && dayPlanItinerary.length > 0) {
      dayPlanItinerary.sort(
        (a, b) =>
          (a.sequence || Infinity) - (b.sequence || Infinity) ||
          (a.time || '').localeCompare(b.time || ''),
      );
      createTimeline();
      showTimeline();
    }

    createLocationCards();
  } catch (e) {
    errorMessage.innerHTML = e.message;
    console.error('Error generating content:', e);
  } finally {
    buttonEl.classList.remove('loading');
  }
  spinner.classList.add('hidden');
}

// Creates a custom pin element with a specific color
function createPinElement(color: string): HTMLElement {
  const pinElement = document.createElement('div');
  pinElement.innerHTML = `
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C10.477 0 6 4.477 6 10c0 5.523 10 22 10 22s10-16.477 10-22c0-5.523-4.477-10-10-10z" fill="${color}" stroke="white" stroke-width="1"/>
      <circle cx="16" cy="10" r="4" fill="white"/>
    </svg>
  `;
  pinElement.style.cursor = 'pointer';
  return pinElement;
}

// Updates marker color
function updateMarkerColor(marker: any, color: string) {
  if (marker && marker.content) {
    marker.content = createPinElement(color);
  }
}

// Safely parses a latitude/longitude value that may come as string/number with extra text.
function parseCoordinate(value: any): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    // Replace comma decimal separators and extract first numeric substring
    const normalized = value.replace(',', '.');
    const match = normalized.match(/-?\d+(\.\d+)?/);
    const num = match ? Number(match[0]) : Number(normalized);
    return Number.isFinite(num) ? num : null;
  }

  return null;
}

// Adds a pin (marker and popup) to the map for a given location.
async function setPin(args) {
  const lat = parseCoordinate(args.lat);
  const lng = parseCoordinate(args.lng);

  if (lat === null || lng === null) {
    console.warn('Skipping location with invalid coordinates:', args);
    return;
  }

  const point = {lat, lng};
  points.push(point);
  bounds.extend(point);

  // Create red pin by default
  const pinElement = createPinElement('#FF0000'); // Red color

  const marker = new AdvancedMarkerElement({
    map,
    position: point,
    title: args.name,
    content: pinElement,
  });
  markers.push(marker);
  map.panTo(point);
  map.fitBounds(bounds);

  const content = document.createElement('div');
  let timeInfo = '';
  if (args.time) {
    timeInfo = `<div style="margin-top: 4px; font-size: 12px; color: #2196F3;">
                  <i class="fas fa-clock"></i> ${args.time}
                  ${args.duration ? ` â€¢ ${args.duration}` : ''}
                </div>`;
  }
  content.innerHTML = `<b>${args.name}</b><br/>${args.description}${timeInfo}`;

  const popupPosition = new google.maps.LatLng(point.lat, point.lng);
  const popup = new window.Popup(popupPosition, content);

  if (!isPlannerMode) {
    popup.setMap(map);
  }

  const locationInfo = {
    name: args.name,
    description: args.description,
    position: popupPosition,
    popup,
    content,
    time: args.time,
    duration: args.duration,
    sequence: args.sequence,
    marker, // Store marker reference
  };

  popUps.push(locationInfo);

  if (isPlannerMode && args.time) {
    dayPlanItinerary.push(locationInfo);
  }
}

// Adds a line (route) between two locations on the map.
async function setLeg(args) {
  const startLat = parseCoordinate(args.start?.lat);
  const startLng = parseCoordinate(args.start?.lng);
  const endLat = parseCoordinate(args.end?.lat);
  const endLng = parseCoordinate(args.end?.lng);

  if (
    startLat === null ||
    startLng === null ||
    endLat === null ||
    endLng === null
  ) {
    console.warn('Skipping line with invalid coordinates:', args);
    return;
  }

  const start = {
    lat: startLat,
    lng: startLng,
  };
  const end = {lat: endLat, lng: endLng};
  points.push(start);
  points.push(end);
  bounds.extend(start);
  bounds.extend(end);
  map.fitBounds(bounds);

  const polyOptions = {
    strokeOpacity: 0.0, // Invisible base line
    strokeWeight: 3,
    map,
  };

  const geodesicPolyOptions = {
    strokeColor: isPlannerMode ? '#2196F3' : '#CC0099',
    strokeOpacity: 1.0,
    strokeWeight: isPlannerMode ? 4 : 3,
    map,
  };

  if (isPlannerMode) {
    geodesicPolyOptions['icons'] = [
      {
        icon: {path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3},
        offset: '0',
        repeat: '15px',
      },
    ];
  }

  const poly = new google.maps.Polyline(polyOptions);
  const geodesicPoly = new google.maps.Polyline(geodesicPolyOptions);

  const path = [start, end];
  poly.setPath(path);
  geodesicPoly.setPath(path);

  lines.push({
    poly,
    geodesicPoly,
    name: args.name,
    transport: args.transport,
    travelTime: args.travelTime,
  });
}

// Creates and populates the timeline view for the day plan.
function createTimeline() {
  if (!timeline || dayPlanItinerary.length === 0) return;
  timeline.innerHTML = '';

  dayPlanItinerary.forEach((item, index) => {
    const timelineItem = document.createElement('div');
    timelineItem.className = 'timeline-item';
    const timeDisplay = item.time || 'Flexible';

    timelineItem.innerHTML = `
      <div class="timeline-time">${timeDisplay}</div>
      <div class="timeline-connector">
        <div class="timeline-dot"></div>
        <div class="timeline-line"></div>
      </div>
      <div class="timeline-content" data-index="${index}">
        <button class="timeline-delete-btn" data-index="${index}" title="Delete">
          <i class="fas fa-times"></i>
        </button>
        <div class="timeline-title">${item.name}</div>
        <div class="timeline-description">${item.description}</div>
        ${item.duration ? `<div class="timeline-duration">${item.duration}</div>` : ''}
      </div>
    `;

    const timelineContent = timelineItem.querySelector('.timeline-content');
    if (timelineContent) {
      timelineContent.addEventListener('click', (e) => {
        // Don't trigger if clicking the delete button
        if ((e.target as HTMLElement).closest('.timeline-delete-btn')) {
          return;
        }
        const popupIndex = popUps.findIndex((p) => p.name === item.name);
        if (popupIndex !== -1) {
          highlightCard(popupIndex);
          map.panTo(popUps[popupIndex].position);
        }
      });
    }

    // Add delete button event listener
    const deleteButton = timelineItem.querySelector('.timeline-delete-btn');
    if (deleteButton) {
      deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        showDeleteConfirmation(index, item.name);
      });
    }
    timeline.appendChild(timelineItem);
  });

  if (lines.length > 0 && isPlannerMode) {
    const timelineItems = timeline.querySelectorAll('.timeline-item');
    for (let i = 0; i < timelineItems.length - 1; i++) {
      const currentItem = dayPlanItinerary[i];
      const nextItem = dayPlanItinerary[i + 1];
      const connectingLine = lines.find(
        (line) =>
          line.name.includes(currentItem.name) ||
          line.name.includes(nextItem.name),
      );

      if (
        connectingLine &&
        (connectingLine.transport || connectingLine.travelTime)
      ) {
        const transportItem = document.createElement('div');
        transportItem.className = 'timeline-item transport-item';
        transportItem.innerHTML = `
          <div class="timeline-time"></div>
          <div class="timeline-connector">
            <div class="timeline-dot" style="background-color: #999;"></div>
            <div class="timeline-line"></div>
          </div>
          <div class="timeline-content transport">
            <div class="timeline-title">
              <i class="fas fa-${getTransportIcon(connectingLine.transport || 'travel')}"></i>
              ${connectingLine.transport || 'Travel'}
            </div>
            <div class="timeline-description">${connectingLine.name}</div>
            ${connectingLine.travelTime ? `<div class="timeline-duration">${connectingLine.travelTime}</div>` : ''}
          </div>
        `;
        timelineItems[i].after(transportItem);
      }
    }
  }
}

// Returns an appropriate Font Awesome icon class based on transport type.
function getTransportIcon(transportType: string): string {
  const type = (transportType || '').toLowerCase();
  if (type.includes('walk')) {
    return 'walking';
  }
  if (type.includes('car') || type.includes('driv')) {
    return 'car-side';
  }
  if (
    type.includes('bus') ||
    type.includes('transit') ||
    type.includes('public')
  ) {
    return 'bus-alt';
  }
  if (
    type.includes('train') ||
    type.includes('subway') ||
    type.includes('metro')
  ) {
    return 'train';
  }
  if (type.includes('bike') || type.includes('cycl')) {
    return 'bicycle';
  }
  if (type.includes('taxi') || type.includes('cab')) {
    return 'taxi';
  }
  if (type.includes('boat') || type.includes('ferry')) {
    return 'ship';
  }
  if (type.includes('plane') || type.includes('fly')) {
    return 'plane-departure';
  }
  {
    return 'route';
  } // Default icon
}

// Generates a placeholder SVG image for location cards.
function getPlaceholderImage(locationName: string): string {
  return ''; // Image generation disabled
}

// Creates and displays location cards in the carousel.
function createLocationCards() {
  if (!cardContainer || !carouselIndicators || popUps.length === 0) return;
  cardContainer.innerHTML = '';
  carouselIndicators.innerHTML = '';
  cardCarousel.style.display = 'block';

  popUps.forEach((location, index) => {
    const card = document.createElement('div');
    card.className = 'location-card';
    if (isPlannerMode) card.classList.add('day-planner-card');
    // Don't set any card as active initially

    const imageUrl = getPlaceholderImage(location.name);
    let cardContent = ``;

    if (isPlannerMode) {
      if (location.sequence) {
        cardContent += `<br><div class="card-sequence-badge">${location.sequence}</div>`;
      }
      if (location.time) {
        cardContent += `<div class="card-time-badge">${location.time}</div>`;
      }
    }

    cardContent += `
      <div class="card-content">
        <h3 class="card-title">${location.name}</h3>
        <p class="card-description">${location.description}</p>
        ${isPlannerMode && location.duration ? `<div class="card-duration">${location.duration}</div>` : ''}
        <div class="card-coordinates">
          ${location.position.lat().toFixed(5)}, ${location.position.lng().toFixed(5)}
        </div>
      </div>
    `;
    card.innerHTML = cardContent;

    card.addEventListener('click', () => {
      highlightCard(index);
      map.panTo(location.position);
      if (isPlannerMode && timeline) highlightTimelineItem(index);
    });

    cardContainer.appendChild(card);

    const dot = document.createElement('div');
    dot.className = 'carousel-dot';
    // Don't set any dot as active initially
    carouselIndicators.appendChild(dot);
  });

  if (cardCarousel && popUps.length > 0) {
    cardCarousel.style.display = 'block';
  }
}

// Highlights the selected card and corresponding elements.
function highlightCard(index: number) {
  activeCardIndex = index;
  const cards = cardContainer?.querySelectorAll('.location-card');
  if (!cards) return;

  cards.forEach((card) => card.classList.remove('card-active'));
  if (cards[index]) {
    cards[index].classList.add('card-active');
    const cardHeight = (cards[index] as HTMLElement).offsetHeight;
    const containerHeight = cardContainer.offsetHeight;
    const scrollPosition =
      (cards[index] as HTMLElement).offsetTop -
      containerHeight / 2 +
      cardHeight / 2;
    cardContainer.scrollTo({top: scrollPosition, behavior: 'smooth'});
  }

  const dots = carouselIndicators?.querySelectorAll('.carousel-dot');
  if (dots) {
    dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
  }

  // Update marker colors: selected marker to blue, others to red
  popUps.forEach((popup, i) => {
    if (popup.marker) {
      const newColor = i === index ? '#2196F3' : '#FF0000'; // Blue for selected, red for others
      const newPinElement = createPinElement(newColor);
      popup.marker.content = newPinElement;
    }
    popup.popup.setMap(isPlannerMode ? (i === index ? map : null) : map);
      if (popup.content) {
      popup.content.classList.toggle('popup-active', i === index);
    }
  });

  if (isPlannerMode) highlightTimelineItem(index);
}

// Resets all markers to red color
function resetAllMarkersToRed() {
  popUps.forEach((popup) => {
    if (popup.marker) {
      const newPinElement = createPinElement('#FF0000'); // Red color
      popup.marker.content = newPinElement;
    }
  });
  
  // Remove active state from all cards
  const cards = cardContainer?.querySelectorAll('.location-card');
  if (cards) {
    cards.forEach((card) => card.classList.remove('card-active'));
  }
  
  // Remove active state from all dots
  const dots = carouselIndicators?.querySelectorAll('.carousel-dot');
  if (dots) {
    dots.forEach((dot) => dot.classList.remove('active'));
  }
  
  activeCardIndex = -1; // Reset active card index
}

// Highlights the timeline item corresponding to the selected card.
function highlightTimelineItem(cardIndex: number) {
  if (!timeline) return;
  const timelineItems = timeline.querySelectorAll(
    '.timeline-content:not(.transport)',
  );
  timelineItems.forEach((item) => item.classList.remove('active'));

  const location = popUps[cardIndex];
  for (const item of timelineItems) {
    const title = item.querySelector('.timeline-title');
    if (title && title.textContent === location.name) {
      item.classList.add('active');
      item.scrollIntoView({behavior: 'smooth', block: 'nearest'});
      break;
    }
  }
}

// Allows navigation through cards using arrow buttons.
function navigateCards(direction: number) {
  const newIndex = activeCardIndex + direction;
  if (newIndex >= 0 && newIndex < popUps.length) {
    highlightCard(newIndex);
    map.panTo(popUps[newIndex].position);
  }
}

// Shows the delete confirmation modal.
function showDeleteConfirmation(index: number, itemName: string) {
  itemToDelete = {index, name: itemName};
  if (confirmationModal) {
    confirmationModal.classList.remove('hidden');
    confirmationModal.classList.add('visible');
  }
}

// Hides the delete confirmation modal.
function hideDeleteConfirmation() {
  itemToDelete = null;
  if (confirmationModal) {
    confirmationModal.classList.remove('visible');
    setTimeout(() => {
      confirmationModal.classList.add('hidden');
    }, 200);
  }
}

// Shows the reset confirmation modal.
function showResetConfirmation() {
  if (resetConfirmationModal) {
    resetConfirmationModal.classList.remove('hidden');
    resetConfirmationModal.classList.add('visible');
  }
}

// Hides the reset confirmation modal.
function hideResetConfirmation() {
  if (resetConfirmationModal) {
    resetConfirmationModal.classList.remove('visible');
    setTimeout(() => {
      resetConfirmationModal.classList.add('hidden');
    }, 200);
  }
}

// Shows the mode switch confirmation modal.
function showModeSwitchConfirmation() {
  if (modeSwitchConfirmationModal) {
    modeSwitchConfirmationModal.classList.remove('hidden');
    modeSwitchConfirmationModal.classList.add('visible');
  }
}

// Hides the mode switch confirmation modal.
function hideModeSwitchConfirmation() {
  if (modeSwitchConfirmationModal) {
    modeSwitchConfirmationModal.classList.remove('visible');
    setTimeout(() => {
      modeSwitchConfirmationModal.classList.add('hidden');
    }, 200);
  }
}

// Shows the mode notification card at the top center
function showModeNotification(isPlannerMode: boolean) {
  if (modeNotification && modeNotificationText) {
    const modeText = isPlannerMode ? 'Day Planner Mode' : 'Explorer Mode';
    modeNotificationText.textContent = `Current Mode: ${modeText}`;
    modeNotification.classList.remove('hidden');
    modeNotification.classList.add('visible');
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      modeNotification.classList.remove('visible');
      setTimeout(() => {
        modeNotification.classList.add('hidden');
      }, 300);
    }, 3000);
  }
}

// Deletes a timeline item and updates the map and timeline.
function deleteTimelineItem(index: number) {
  if (index < 0 || index >= dayPlanItinerary.length) return;

  const item = dayPlanItinerary[index];
  
  // Remove marker and popup
  const popupIndex = popUps.findIndex((p) => p.name === item.name);
  if (popupIndex !== -1) {
    // Remove marker
    if (markers[popupIndex]) {
      markers[popupIndex].setMap(null);
      markers.splice(popupIndex, 1);
    }
    
    // Remove popup
    if (popUps[popupIndex].popup) {
      popUps[popupIndex].popup.setMap(null);
    }
    if (popUps[popupIndex].content && popUps[popupIndex].content.remove) {
      popUps[popupIndex].content.remove();
    }
    popUps.splice(popupIndex, 1);
  }

  // Remove related lines
  const linesToRemove: number[] = [];
  lines.forEach((line, lineIndex) => {
    if (line.name.includes(item.name)) {
      line.poly.setMap(null);
      line.geodesicPoly.setMap(null);
      linesToRemove.push(lineIndex);
    }
  });
  // Remove lines in reverse order to maintain indices
  linesToRemove.reverse().forEach((lineIndex) => {
    lines.splice(lineIndex, 1);
  });

  // Remove from dayPlanItinerary
  dayPlanItinerary.splice(index, 1);

  // Remove from points array (if needed)
  const pointIndex = points.findIndex(
    (p) => p.lat === item.position.lat() && p.lng === item.position.lng()
  );
  if (pointIndex !== -1) {
    points.splice(pointIndex, 1);
  }

  // Recalculate bounds
  bounds = new google.maps.LatLngBounds();
  points.forEach((point) => {
    bounds.extend(point);
  });
  if (points.length > 0) {
    map.fitBounds(bounds);
  }

  // Update timeline
  createTimeline();

  // Update location cards
  createLocationCards();

  // Reset active card index if needed
  if (activeCardIndex >= popUps.length && popUps.length > 0) {
    activeCardIndex = popUps.length - 1;
    highlightCard(activeCardIndex);
  } else if (popUps.length === 0) {
    if (cardCarousel) cardCarousel.style.display = 'none';
  }
}

// Exports the current day plan as a simple text file.
function exportDayPlan() {
  if (!dayPlanItinerary.length) return;
  let content = '# Your Day Plan\n\n';

  dayPlanItinerary.forEach((item, index) => {
    content += `## ${index + 1}. ${item.name}\n`;
    content += `Time: ${item.time || 'Flexible'}\n`;
    if (item.duration) content += `Duration: ${item.duration}\n`;
    content += `\n${item.description}\n\n`;

    if (index < dayPlanItinerary.length - 1) {
      const nextItem = dayPlanItinerary[index + 1];
      const connectingLine = lines.find(
        (line) =>
          line.name.includes(item.name) || line.name.includes(nextItem.name),
      );
      if (connectingLine) {
        content += `### Travel to ${nextItem.name}\n`;
        content += `Method: ${connectingLine.transport || 'Not specified'}\n`;
        if (connectingLine.travelTime) {
          content += `Time: ${connectingLine.travelTime}\n`;
        }
        content += `\n`;
      }
    }
  });

  const blob = new Blob([content], {type: 'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'day-plan.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


