<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Carlsberg Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            margin: 0;
            background-color: #1a1f24;
            color: #ffffff;
            font-family: 'Inter', sans-serif;
        }
        .container {
            max-width: 1440px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #2b3239;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .header-content {
            display: grid;
            grid-template-columns: auto 1fr auto;
            gap: 40px;
            align-items: center;
        }

        .header-title {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }

        .header-title h1 {
            font-size: 24px;
            font-weight: 700;
            margin: 0;
        }

        .header-info {
            display: flex;
            gap: 20px;
            align-items: center;
            color: #b0b3b8;
        }

        .header-info-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .header-info-item span {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }

        .header-info-item.running span {
            background-color: #4caf50;
        }

        .user-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .user-info img {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: 2px solid #4caf50;
        }
        .status-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            background-color: #2b3239;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            margin-bottom: 30px;
        }
        .status-bar .oee {
            font-size: 18px;
            font-weight: 600;
            color: #67c23a;
        }
        .status-bar .live-indicator {
            color: #f56c6c;
            font-weight: 600;
        }
        .batch-info {
            background-color: #1c252b;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
        }
        .batch-info h2 {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 15px;
        }
        .batch-details {
            display: grid;
            grid-template-columns: 1fr 1px 1fr 1px 300px;
            gap: 20px;
            align-items: start;
        }
        .batch-details > div:nth-child(2),
        .batch-details > div:nth-child(4) {
            background-color: #3a3f44;
            width: 1px;
        }
        .progress-container {
            background-color: #3a3f44;
            height: 10px;
            border-radius: 5px;
            margin: 10px 0;
            position: relative;
        }
        .progress-bar {
            background-color: #4caf50;
            height: 10px;
            border-radius: 5px;
            width: 10%;
        }
        .status-indicator {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .status-indicator span {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background-color: #4caf50;
        }
        .chart-container {
            width: 200px;
            height: 200px;
            margin: 0 auto;
        }
        .production-overview {
            position: relative;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background-color: #2b3239;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .card h2 {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 10px;
        }
        .card p {
            font-size: 14px;
            color: #b0b3b8;
        }
        .material-status {
            background-color: #1c252b;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
        }

        .material-status h2 {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 15px;
        }

        .material-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }

        .material-card {
            background-color: #2b3239;
            border-radius: 8px;
            padding: 15px;
        }

        .material-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .material-header h3 {
            font-size: 16px;
            font-weight: 600;
        }

        .status-tag {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
        }

        .status-tag.good {
            background-color: #4caf50;
            color: white;
        }

        .status-tag.warning {
            background-color: #FFA500;
            color: white;
        }

        .material-details p {
            margin: 8px 0;
            font-size: 14px;
            color: #b0b3b8;
        }

        .material-progress {
            background-color: #3a3f44;
            height: 8px;
            border-radius: 4px;
            margin-top: 15px;
        }

        .material-progress .progress-bar {
            background-color: #4caf50;
            height: 100%;
            border-radius: 4px;
            transition: width 0.3s ease;
        }

        .shift-handover {
            background-color: #1c252b;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
        }

        .handover-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            padding: 10px;
        }

        .handover-header h2 {
            font-size: 20px;
            font-weight: 600;
        }

        .handover-content {
            display: none;
            padding: 15px;
            background-color: #2b3239;
            border-radius: 8px;
            margin-top: 10px;
        }

        .handover-content.active {
            display: block;
        }

        .handover-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }

        .summary-item {
            padding: 10px;
            background-color: #1c252b;
            border-radius: 4px;
        }

        .handover-notes {
            background-color: #1c252b;
            padding: 15px;
            border-radius: 4px;
        }

        .toggle-icon {
            color: #b0b3b8;
            font-size: 24px;
        }

        .warning-message {
            background-color: #ff9800;
            color: white;
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
            display: none;
            animation: fadeIn 0.5s;
        }

        .error-message {
            background-color: #f44336;
            color: white;
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
            display: none;
            animation: fadeIn 0.5s;
        }

        .card.warning {
            border: 2px solid #ff9800;
            box-shadow: 0 0 10px rgba(255, 152, 0, 0.3);
        }

        .card.error {
            border: 2px solid #f44336;
            box-shadow: 0 0 10px rgba(244, 67, 54, 0.3);
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        /* Add to existing styles */
        .arrow-indicator {
            position: absolute;
            left: calc(15% + 50px);
            top: 50%;
            transform: translateY(-50%);
            width: 50px;
            height: 30px;
            opacity: 0;
            visibility: hidden;
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .arrow-indicator::after {
            content: '→';
            font-size: 36px; /* Increased size */
            font-weight: bold; /* Make it bolder */
            color: currentColor;
            text-shadow: 0 0 10px currentColor; /* Add glow effect */
        }

        .arrow-indicator.warning {
            visibility: visible;
            opacity: 1;
            color: #ff9800;
            animation: arrowPulse 2s infinite;
        }

        .arrow-indicator.error {
            visibility: visible;
            opacity: 1;
            color: #f44336;
            animation: arrowPulse 1s infinite;
        }

        @keyframes arrowPulse {
            0% { opacity: 0.6; transform: translateY(-50%) scale(1); }
            50% { opacity: 1; transform: translateY(-50%) scale(1.3); }
            100% { opacity: 0.6; transform: translateY(-50%) scale(1); }
        }

        .warning-indicator {
            position: absolute;
            left: calc(15% + 36px);
            top: -20px; /* Position above machines */
            width: 60px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            opacity: 0;
            visibility: hidden;
            z-index: 1000;
        }

        .warning-indicator .dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background-color: currentColor;
        }

        .warning-indicator .exclamation {
            font-size: 30px;
            font-weight: bold;
        }

        .warning-indicator.warning {
            visibility: visible;
            opacity: 1;
            color: #ff9800;
        }

        .warning-indicator.error {
            visibility: visible;
            opacity: 1;
            color: #f44336;
        }

        .warning-indicator.warning .dot {
            animation: dotPulse 2s infinite;
        }

        .warning-indicator.error .dot {
            animation: dotPulse 1s infinite;
        }

        @keyframes dotPulse {
            0% { transform: scale(1); opacity: 0.6; }
            50% { transform: scale(1.5); opacity: 1; }
            100% { transform: scale(1); opacity: 0.6; }
        }

        .copilot-button {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background-color: #4caf50;
            cursor: move;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }

        .chat-container {
            position: fixed;
            bottom: 90px;
            right: 20px;
            width: 300px;
            height: 400px;
            background-color: #2b3239;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            display: none;
            flex-direction: column;
            z-index: 999;
        }

        .chat-header {
            padding: 15px;
            background-color: #1c252b;
            border-radius: 8px 8px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .chat-messages {
            flex: 1;
            padding: 15px;
            overflow-y: auto;
        }

        .chat-input {
            padding: 15px;
            border-top: 1px solid #3a3f44;
            display: flex;
            gap: 10px;
        }

        .chat-input input {
            flex: 1;
            padding: 8px;
            border-radius: 4px;
            border: 1px solid #3a3f44;
            background-color: #1c252b;
            color: white;
        }

        .chat-input button {
            padding: 8px 15px;
            border-radius: 4px;
            background-color: #4caf50;
            color: white;
            border: none;
            cursor: pointer;
        }

        .overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
            z-index: 998;
        }

        .overlay.active {
            opacity: 1;
            visibility: visible;
        }

        .card.focus {
            position: relative;
            z-index: 999;
            transform: scale(1.05);
            transition: all 0.3s ease;
            box-shadow: 0 0 20px rgba(255, 255, 255, 0.1);
        }

        .card.warning.focus {
            box-shadow: 0 0 20px rgba(255, 152, 0, 0.3);
        }

        .card.error.focus {
            box-shadow: 0 0 20px rgba(244, 67, 54, 0.3);
        }

        #alertContainer {
            position: absolute;
            z-index: 1000;
            transition: all 0.3s ease;
        }

        .warning-message, .error-message {
            background-color: #2b3239;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            margin: 10px 0;
            display: none;
            animation: fadeIn 0.5s;
            transition: all 0.3s ease;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }

        .warning-message.focus {
            border-left: 4px solid #ff9800;
            box-shadow: 0 0 20px rgba(255, 152, 0, 0.3);
        }

        .error-message.focus {
            border-left: 4px solid #f44336;
            box-shadow: 0 0 20px rgba(244, 67, 54, 0.3);
        }
    </style>
    <!-- Add Font Awesome for icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="header-content">
                <div class="header-title">
                    <h1>Carlsberg Dashboard</h1>
                    <p>Production Line Overview</p>
                </div>
                <div class="header-info">
                    <div class="header-info-item">
                        <i class="fas fa-industry"></i>
                        Plant: Falkenberg
                    </div>
                    <div class="header-info-item">
                        <i class="fas fa-cog"></i>
                        Line: 65
                    </div>
                    <div class="header-info-item running">
                        <span></span>
                        Status: Running
                    </div>
                    <div class="header-info-item">
                        <i class="fas fa-clock"></i>
                        Shift: Morning
                    </div>
                </div>
                <div class="user-info">
                    <div>
                        <p style="margin: 0; font-weight: 600;">KEVIN</p>
                        <p style="margin: 0; font-size: 12px; color: #b0b3b8;">Line Operator</p>
                    </div>
                    <img src="https://via.placeholder.com/40" alt="Profile Picture">
                </div>
            </div>
        </div>

        <!-- Status Bar -->
        <div class="status-bar">
            <p>Currently Producing: Pripps Blå CAN 4x6x0.5 3.5%</p>
            <p class="oee">Current Run OEE: 67.43%</p>
            <p class="live-indicator">LIVE</p>
        </div>

        <!-- Alert Container -->
        <div id="alertContainer"></div>

        <!-- Production Overview -->
        <div class="production-overview">
            <div class="arrow-indicator" id="machineArrow"></div>
            <div class="warning-indicator" id="machineWarning">
                <div class="dot"></div>
                <span class="exclamation">!</span>
                <div class="dot"></div>
            </div>
            <div class="card" id="depalletizer">
                <h2>Depalletizer</h2>
                <p>Running</p>
                <p>2/480 Pallets separated</p>
            </div>
            <div class="card" id="filler">
                <h2>Filler</h2>
                <p>Running</p>
                <p>862 Units filled</p>
            </div>
            <div class="card">
                <h2>Tray Packer</h2>
                <p>Running</p>
                <p>1,245 Units packed</p>
            </div>
            <div class="card">
                <h2>ShrinkPacker</h2>
                <p>Running</p>
                <p>1,786 Units ShrinkWrapped</p>
            </div>
            <div class="card">
                <h2>Palletizer</h2>
                <p>Running</p>
                <p>18/128 Pallets completed</p>
            </div>
        </div>

        <!-- Material Status -->
        <div class="material-status">
            <h2>Material Status</h2>
            <div class="material-cards">
                <div class="material-card">
                    <div class="material-header">
                        <h3>Tray Material</h3>
                        <span class="status-tag good">In Stock</span>
                    </div>
                    <div class="material-details">
                        <p>Current Stock: 12,500 units</p>
                        <p>Consumption Rate: 2,400 units/hour</p>
                        <p>Remaining Time: 5.2 hours</p>
                        <div class="material-progress">
                            <div class="progress-bar" style="width: 65%;"></div>
                        </div>
                    </div>
                </div>

                <div class="material-card">
                    <div class="material-header">
                        <h3>Shrink</h3>
                        <span class="status-tag warning">Low Stock</span>
                    </div>
                    <div class="material-details">
                        <p>Current Stock: 4,200 units</p>
                        <p>Consumption Rate: 2,400 units/hour</p>
                        <p>Remaining Time: 1.75 hours</p>
                        <div class="material-progress">
                            <div class="progress-bar" style="width: 25%; background-color: #FFA500;"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Current Batch -->
        <div class="batch-info">
            <h2>Current Batch</h2>
            <div class="batch-details">
                <div>
                    <p>Order: 110351471</p>
                    <p>Pripps Blå CAN 4x6x0.5 3.5%</p>
                    <p>Scheduled Time: 248 minutes</p>
                    <p>Best Practice: 239 minutes</p>
                    <p>Unit Amount: 270,300</p>
                </div>
                <div></div> <!-- Divider -->
                <div>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: 10%;"></div>
                    </div>
                    <p>2,380 of 526,440 Units Produced</p>
                    <div class="status-indicator">
                        <span class="on-schedule"></span>
                        <p>On Schedule</p>
                    </div>
                </div>
                <div></div> <!-- Divider -->
                <div class="chart-container">
                    <canvas id="currentStopsChart"></canvas>
                </div>
            </div>
        </div>

        <!-- Upcoming Batch -->
        <div class="batch-info">
            <h2>Upcoming Batch</h2>
            <div class="batch-details">
                <div>
                    <p>Order: 110351472</p>
                    <p>Falcon Export CAN 4x6x0.5 5.2%</p>
                    <p>Scheduled Time: 180 minutes</p>
                    <p>Best Practice: 175 minutes</p>
                    <p>Unit Amount: 180,000</p>
                </div>
                <div></div> <!-- Divider -->
                <div>
                    <div class="progress-container">
                        <div class="progress-bar" style="width: 0%; background-color: #FFA500;"></div>
                    </div>
                    <p>Starts in: 2 hours 15 minutes</p>
                    <div class="status-indicator">
                        <span class="on-schedule" style="background-color: #FFA500;"></span>
                        <p>Scheduled</p>
                    </div>
                </div>
                <div></div> <!-- Divider -->
                <div class="chart-container">
                    <canvas id="upcomingStopsChart"></canvas>
                </div>
            </div>
        </div>

        <!-- Shift Handover -->
        <div class="shift-handover">
            <div class="handover-header" onclick="toggleHandover()">
                <h2>Shift Handover</h2>
                <span class="toggle-icon">+</span>
            </div>
            <div class="handover-content" id="handoverContent">
                <div class="handover-summary">
                    <div class="summary-item">
                        <h3>Production Output</h3>
                        <p>Target: 250,000 units</p>
                        <p>Achieved: 245,000 units</p>
                    </div>
                    <div class="summary-item">
                        <h3>OEE Performance</h3>
                        <p>Average: 67.43%</p>
                        <p>Peak: 89.2%</p>
                    </div>
                    <div class="summary-item">
                        <h3>Stops</h3>
                        <p>Total: 45 minutes</p>
                        <p>Major: 2 incidents</p>
                    </div>
                </div>
                <div class="handover-notes">
                    <h3>Shift Notes</h3>
                    <p>• Material change completed at 14:30 - New batch running stable</p>
                    <p>• Minor adjustment needed on filler - Check pressure settings</p>
                    <p>• Maintenance crew: Changed cylinder in OCME</p>
                </div>
            </div>
        </div>
    </div>

    <div class="copilot-button" id="copilotBtn">
        <i class="fas fa-robot"></i>
    </div>

    <div class="chat-container" id="chatContainer">
        <div class="chat-header"></div>
            <h3>Co-pilot</h3>
            <button onclick="""toggleChat()">×</button>
        </div>
        <div class="""chat-messages" id="chatMessages"></div>
        <div class="""chat-input"></div>
            <input type="""text" id="""chatInput" placeholder="""Ask a question...">
            <button onclick="sendMessage()">Send</button>
        </div>
    </div>

    <script>
        // Initialize current batch stops chart
        const currentCtx = document.getElementById('currentStopsChart').getContext('2d');
        new Chart(currentCtx, {
            type: 'doughnut',
            data: {
                labels: ['CIP Issues', 'Filler crash', 'Breakdown OCME'],
                datasets: [{
                    data: [3, 2, 1],
                    backgroundColor: ['#4CAF50', '#FFC107', '#F44336']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#ffffff' }
                    }
                }
            }
        });

        // Initialize upcoming batch stops chart
        const upcomingCtx = document.getElementById('upcomingStopsChart').getContext('2d');
        new Chart(upcomingCtx, {
            type: 'doughnut',
            data: {
                labels: ['Issues after changeover', 'Falling cans on conveyor', 'Pallet Collapse'],
                datasets: [{
                    data: [75, 15, 10],
                    backgroundColor: ['#FFA500', '#4CAF50', '#2196F3']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#ffffff' }
                    }
                }
            }
        });

        // Toggle handover content
        function toggleHandover() {
            const content = document.getElementById('handoverContent');
            const icon = document.querySelector('.toggle-icon');
            content.classList.toggle('active');
            icon.textContent = content.classList.contains('active') ? '−' : '+';
        }

        document.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                startErrorScenario();
            }
        });

        function startErrorScenario() {
            const overlay = document.createElement('div');
            overlay.className = 'overlay';
            document.body.appendChild(overlay);
            
            const depalletizer = document.getElementById('depalletizer');
            const filler = document.getElementById('filler');
            const arrow = document.getElementById('machineArrow');
            const warning = document.getElementById('machineWarning');

            const alertContainer = document.getElementById('alertContainer');
            alertContainer.style.zIndex = '1000';

            // Warning state
            setTimeout(() => {
                overlay.classList.add('active');
                depalletizer.classList.add('warning', 'focus');
                filler.classList.add('warning', 'focus');
                arrow.classList.add('warning');
                warning.classList.add('warning');
                showAlert('warning', 'Varning: Långsammare än normal hastighet på transportbanan mellan Depalletizer och Filler');
            }, 1000);

            // Error state
            setTimeout(() => {
                depalletizer.classList.remove('warning');
                filler.classList.remove('warning');
                arrow.classList.remove('warning');
                warning.classList.remove('warning');
                
                depalletizer.classList.add('error');
                filler.classList.add('error');
                arrow.classList.add('error');
                warning.classList.add('error');
                showAlert('error', 'FEL: Transportband stannat mellan Depalletizer och Filler - Kontakta underhåll');
            }, 10000);

            // Add click handler to remove overlay
            overlay.addEventListener('click', () => {
                overlay.classList.remove('active');
                document.querySelectorAll('.focus').forEach(el => el.classList.remove('focus'));
                alertContainer.style.zIndex = '';
            });
        }

        function showAlert(type, message) {
            const alertContainer = document.getElementById('alertContainer');
            const depalletizer = document.getElementById('depalletizer');
            
            // Remove all existing alerts with fade out
            const existingAlerts = alertContainer.children;
            Array.from(existingAlerts).forEach(alert => {
                alert.style.opacity = '0';
                setTimeout(() => alert.remove(), 300);
            });

            // Create new alert
            const alert = document.createElement('div');
            alert.className = type === 'warning' ? 'warning-message' : 'error-message';
            alert.textContent = message;
            alert.style.display = 'block';
            alert.classList.add('focus');
            
            // Position alert higher above machines (changed from -80 to -120)
            const rect = depalletizer.getBoundingClientRect();
            alertContainer.style.position = 'absolute';
            alertContainer.style.top = `${rect.top - 120}px`;
            alertContainer.style.left = `${rect.left}px`;
            alertContainer.style.width = '400px';
            
            // Add new alert after fade out of previous
            setTimeout(() => {
                alertContainer.appendChild(alert);
            }, 300);
        }

        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        const copilotBtn = document.getElementById("copilotBtn");

        copilotBtn.addEventListener("mousedown", dragStart);
        document.addEventListener("mousemove", drag);
        document.addEventListener("mouseup", dragEnd);

        function dragStart(e) {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            if (e.target === copilotBtn) {
                isDragging = true;
            }
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                xOffset = currentX;
                yOffset = currentY;
                copilotBtn.style.transform = `translate(${currentX}px, ${currentY}px)`;
            }
        }

        function dragEnd() {
            isDragging = false;
        }

        function toggleChat() {
            const chatContainer = document.getElementById("chatContainer");
            chatContainer.style.display = chatContainer.style.display === "none" ? "flex" : "none";
        }

        copilotBtn.addEventListener("click", function(e) {
            if (!isDragging) {
                toggleChat();
            }
        });

        function sendMessage() {
            const input = document.getElementById("chatInput");
            const messages = document.getElementById("chatMessages");
            if (input.value.trim() !== "") {
                const messageDiv = document.createElement("div");
                messageDiv.textContent = input.value;
                messages.appendChild(messageDiv);
                input.value = "";
            }
        }
    </script>
</body>
</html>
