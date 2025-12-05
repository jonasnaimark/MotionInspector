# Spectrum Editor

A web-based timeline visualization tool for After Effects animation specifications with synchronized video playback.

## Features

- **Timeline Visualization**: View animation timing, easing curves, and property changes on an interactive timeline
- **Video Synchronization**: Upload a video reference and sync it with your animation timeline
- **Playback Controls**: Variable speed playback (1x, 0.5x, 0.1x) for detailed inspection
- **Interactive Playhead**: Drag to scrub through animations and see exact timing
- **Animation Details**: Click any animation bar to see detailed information including:
  - Start/End values
  - Easing curves (Cubic Bezier or Spring parameters)
  - Natural language descriptions
  - Duration and timing
- **Property-Specific Colors**: Different animation properties are color-coded for easy identification
- **Spring Animations**: Special handling for spring-based animations with preset links
- **Project & Spec Organization**: Header fields for Project name and Spec name with dynamic page title

## Usage

1. Open `SpectrumEditor.html` in a modern web browser
2. Paste your After Effects animation spec JSON (copied from your motion spec tool)
3. Optionally upload a reference video to sync with the timeline
4. Use the playback controls to play, pause, or adjust playback speed
5. Drag the playhead to scrub through the timeline
6. Click on any animation bar to view detailed information
7. Edit the Project and Spec name fields in the header to organize your specs

## Tech Stack

- Pure HTML/CSS/JavaScript (no dependencies)
- Uses RequestAnimationFrame for smooth playhead animation
- Supports modern browsers (Chrome, Firefox, Safari, Edge)

## Export

Use the "Export Zip" button to create a self-contained package that includes:
- The animation spec data
- Embedded video (if uploaded)
- All functionality in a single HTML file for easy sharing

## Development

This is a single-file application. All code is contained in `SpectrumEditor.html`.

## License

MIT
