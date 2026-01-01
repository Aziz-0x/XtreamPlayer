// Global State
let userConfig = {
    url: '',
    username: '',
    password: ''
};

let currentData = [];
let currentCategories = [];

// Player Instances
let plyrInstance = null;
let hlsInstance = null;
// random things 


function print(text) {
    console.log(text);
}
    
function debug() {
    print("Debug mode activated");
    login(true);
}

// --- Authentication ---
async function login(debugMode) {
    let host = document.getElementById('host').value.replace(/\/$/, ""); // Remove trailing slash
    let user = document.getElementById('username').value;
    let pass = document.getElementById('password').value;
    if (debugMode) {
        host = "http://aseaf1.me:8080".replace(/\/$/, "");
        user = "119535533584";
        pass = "137799332661";
    }


    const errorMsg = document.getElementById('error-msg');

    if (!host || !user || !pass) {
        errorMsg.innerText = "Please fill in all fields.";
        return;
    }

    userConfig = { url: host, username: user, password: pass };
    
    // Auth URL structure for Xtream Codes
    const authUrl = `${host}/player_api.php?username=${user}&password=${pass}`;

    try {
        const response = await fetch(authUrl);
        const data = await response.json();

        if (data.user_info.auth === 1) {
            // Success
            document.getElementById('login-container').classList.add('hidden');
            document.getElementById('dashboard').classList.remove('hidden');
            showSection('live');
        } else {
            errorMsg.innerText = "Invalid credentials or expired account.";
        }
    } catch (error) {
        console.error(error);
        errorMsg.innerText = "Connection failed. Check CORS or Host URL.";
    }
}

function displayAccountInfo(info) {
    const container = document.getElementById('account-info');
    const expDate = new Date(info.exp_date * 1000).toLocaleDateString();
    container.innerHTML = `
        <p><strong>Status:</strong> ${info.status}</p>
        <p><strong>Expiry:</strong> ${expDate}</p>
        <p><strong>Max Conn:</strong> ${info.max_connections}</p>
    `;
}

function logout() {
    location.reload();
}

// --- Data Fetching ---

// Generic fetch function for Xtream Actions
async function fetchData(action) {
    const url = `${userConfig.url}/player_api.php?username=${userConfig.username}&password=${userConfig.password}&action=${action}`;
    try {
        const res = await fetch(url);
        return await res.json();
    } catch (e) {
        console.error("Error fetching data", e);
        return [];
    }
}

async function showSection(type) {
    document.getElementById('stream-grid').innerHTML = '<p>Loading...</p>';
    document.getElementById('category-list').innerHTML = '<li>Loading...</li>';
    
    // Update active button state
    document.querySelectorAll('.sidebar nav button').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    let catAction = '';
    let streamAction = '';

    if (type === 'live') {
        document.getElementById('section-title').innerText = "Live TV";
        catAction = 'get_live_categories';
        streamAction = 'get_live_streams';
    } else if (type === 'vod') {
        document.getElementById('section-title').innerText = "Movies";
        catAction = 'get_vod_categories';
        streamAction = 'get_vod_streams';
    } else if (type === 'series') {
        document.getElementById('section-title').innerText = "Series";
        catAction = 'get_series_categories';
        streamAction = 'get_series';
    }

    // 1. Fetch Categories
    currentCategories = await fetchData(catAction);
    renderCategories(currentCategories, streamAction);

    // 2. Fetch All Streams (Initial Load)
    // Note: On large playlists, fetching ALL streams at once can be slow. 
    // Usually, you fetch by category_id, but here we fetch all for client-side filtering demo.
    currentData = await fetchData(streamAction);
    renderGrid(currentData);
}

// --- Rendering ---

function renderCategories(categories, streamAction) {
    const list = document.getElementById('category-list');
    list.innerHTML = `<li onclick="filterByCategory('all')">All Categories</li>`;
    
    categories.forEach(cat => {
        const li = document.createElement('li');
        li.innerText = cat.category_name;
        li.onclick = () => filterByCategory(cat.category_id);
        list.appendChild(li);
    });
}

function filterByCategory(catId) {
    if (catId === 'all') {
        renderGrid(currentData, item.category_id);
    } else {
        const filtered = currentData.filter(item => item.category_id == catId);
        renderGrid(filtered);
    }
    
    // Highlight active category
    const items = document.querySelectorAll('#category-list li');
    items.forEach(item => item.classList.remove('active'));
    event.target.classList.add('active');
}

function renderGrid(data, categoryId) {
    const grid = document.getElementById('stream-grid');
    grid.innerHTML = '';

    // Limit to first 100 to prevent browser crash if list is huge
    const displayData = data.slice(0, 100); 

    displayData.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';
        print("Rendering item: " + (item.name || item.title));
        // Determine Image and Name based on Live or VOD
        if (categoryId !== undefined) {
            const imgUrl = item.stream_icon || './placeholder.png';
            const title = item.name || item.title;
            const streamId = item.stream_id || item.series_id;
    
            card.innerHTML = `
                <img src="${imgUrl}" onerror="this.src='./placeholder.png'">
                <div class="card-body">
                    <div class="card-title" title="${title}">${title}</div>
                </div>
            `;
        } else {
            const imgUrl = item.stream_icon || './placeholder.png';
            const title = item.name || item.title;
            const streamId = item.stream_id || item.series_id;
    
            card.innerHTML = `
                <img src="${imgUrl}" onerror="this.src='./placeholder.png'">
                <div class="card-body">
                    <div class="card-title" title="${title}">${title}</div>
                </div>
            `;
        }
        
        card.onclick = () => playStream(item);
        grid.appendChild(card);
    });
}

// --- Search Function ---
function filterContent() {
    const query = document.getElementById('search-box').value.toLowerCase();
    const filtered = currentData.filter(item => {
        const title = (item.name || item.title).toLowerCase();
        return title.includes(query);
    });
    renderGrid(filtered);
}

// ... (Keep your Login and Fetch logic same as before) ...

// --- Player Logic ---

// --- UPDATED PLYR + HLS LOGIC ---

function playStream(item) {
    const modal = document.getElementById('video-modal');
    document.getElementById('player-title').innerText = item.name || item.title;
    modal.classList.remove('hidden');

    const video = document.getElementById('player');
    
    // Construct HLS URL (Force .m3u8)
    let streamUrl = '';
    if (item.stream_type && item.stream_type === 'live') {
        streamUrl = `${userConfig.url}/live/${userConfig.username}/${userConfig.password}/${item.stream_id}.m3u8`;
    } else {
        // For VOD, usually .m3u8 works, if not, might need .mp4 fallback logic
        streamUrl = `${userConfig.url}/movie/${userConfig.username}/${userConfig.password}/${item.stream_id}.m3u8`;
    }

    // 1. Check if HLS.js is supported (Chrome, Firefox, Edge)
    if (Hls.isSupported()) {
        hlsInstance = new Hls();
        hlsInstance.loadSource(streamUrl);
        hlsInstance.attachMedia(video);
        
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
            video.play();
        });
    }
    // 2. Fallback for Safari (Native HLS support)
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.addEventListener('loadedmetadata', function() {
            video.play();
        });
    }

    // 3. Initialize Plyr UI
    if (!plyrInstance) {
        plyrInstance = new Plyr(video, {
            controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'],
            settings: ['quality', 'speed']
        });
    }
}

function closePlayer() {
    const modal = document.getElementById('video-modal');
    modal.classList.add('hidden');

    // Destroy HLS instance to stop buffering/downloading
    if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
    }

    // Pause the HTML video element directly
    const video = document.getElementById('player');
    video.pause();
    video.src = ""; 
    video.load();
}