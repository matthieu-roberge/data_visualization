// Config
const timelineWidth = 722;
const startTime = "16:00"; // starting time
const endTime = "16:25";   // ending time
const totalMinutes = timeStringToMinutes(endTime) - timeStringToMinutes(startTime);
const pixelsPerMinute = timelineWidth / totalMinutes; // 600 / 25 = 24

// Helper: convert "HH:MM" string to minutes since 00:00
function timeStringToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

// Helper: convert minutes since 00:00 to "HH:MM"
function minutesToTimeString(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}`;
}

// Pixels → Time
function pixelsToTime(pixelX) {
    const startMinutes = timeStringToMinutes(startTime);
    const minutesFromStart = pixelX / pixelsPerMinute;
    return minutesToTimeString(Math.round(startMinutes + minutesFromStart));
}

// Time → Pixels
function timeToPixels(timeStr) {
    const startMinutes = timeStringToMinutes(startTime);
    const targetMinutes = timeStringToMinutes(timeStr);
    const minutesFromStart = targetMinutes - startMinutes;
    return minutesFromStart * pixelsPerMinute;
}
