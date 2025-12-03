/**
 * Standalone Figma Motion Spec Exporter - HTTP Bridge Version
 * Extracts keyframe data from After Effects and sends directly to Figma via HTTP bridge
 *
 * Features:
 * - Seamless AE → Figma communication via HTTP bridge server
 * - Batch processing of multiple selected properties across layers
 * - Smart animation counting and preview
 * - Universal property detection (Position, Scale, Rotation, Color, Effects, etc.)
 * - Spring detection (marker parsing + baked spring analysis)
 * - Cubic bezier extraction from selected keyframes
 * - Resolution scaling (1x/2x/3x automatic detection)
 */

// Global configuration
var MOTION_SPEC_CONFIG = {
    DEBUG_MODE: true,
    VERSION: "2.0.0",
    BRIDGE_SERVER: "http://localhost:3000",
    TARGET_RESOLUTION: "1x",
    SCALE_OVERRIDE: 0 // 0 = auto, 1 = 1x, 2 = 2x, 3 = 3x, 4 = 4x
};

// Debug utilities
var DEBUG = {
    messages: [],
    log: function(message, data) {
        if (!MOTION_SPEC_CONFIG.DEBUG_MODE) return;
        var logMsg = "[MotionSpec] " + message + (data ? " | " + data : "");
        $.writeln(logMsg);
        this.messages.push(logMsg);
    },
    error: function(message, error) {
        var logMsg = "[MotionSpec] Error: " + message + " | " + error.toString();
        $.writeln(logMsg);
        this.messages.push(logMsg);
    },
    clear: function() {
        this.messages = [];
    }
};

// Spring presets from the shared library
var SPRING_PRESETS = {
    "Standard Spring": { stiffness: 175, damping: 26.46, dampingRatio: 1, mass: 1 },
    "Fast Spring": { stiffness: 300, damping: 34.64, dampingRatio: 1, mass: 1 },
    "Slow Spring": { stiffness: 100, damping: 20, dampingRatio: 1, mass: 1 },
    "Gentle Spring": { stiffness: 120, damping: 18, dampingRatio: 0.8, mass: 1 },
    "Snappy Spring": { stiffness: 400, damping: 40, dampingRatio: 1, mass: 1 },
    "Bouncy Spring": { stiffness: 200, damping: 12, dampingRatio: 0.6, mass: 1 }
};

// File-based communication functions
function sendToFigmaViaFile(motionSpecData) {
    DEBUG.log("=== SENDING TO FIGMA VIA FILE ===");

    try {
        var jsonPayload = JSON.stringify(motionSpecData, null, 2);
        DEBUG.log("Payload size: " + jsonPayload.length + " chars");

        // Create unique filename with timestamp
        var timestamp = new Date().getTime();
        var fileName = "motion_spec_" + timestamp + ".json";

        // Write to inbox folder for bridge server to watch
        var homeFolder = Folder("~");
        var inboxFolder = new Folder(homeFolder.fsName + "/Documents/MotionSpecs/inbox");

        // Ensure inbox folder exists
        if (!inboxFolder.exists) {
            inboxFolder.create();
        }

        var specFile = new File(inboxFolder.fsName + "/" + fileName);

        DEBUG.log("Writing file: " + specFile.fsName);

        // Write JSON data to file
        specFile.open("w");
        specFile.write(jsonPayload);
        specFile.close();

        // Verify file was written successfully
        if (specFile.exists) {
            var fileSize = specFile.length;
            DEBUG.log("File written successfully: " + fileSize + " bytes");

            return {
                success: true,
                fileName: fileName,
                filePath: specFile.fsName,
                fileSize: fileSize,
                message: "Motion spec saved to file - bridge server will process automatically"
            };
        } else {
            DEBUG.error("File Write Failed", "File does not exist after write attempt");
            return {
                success: false,
                error: "Failed to write motion spec file",
                details: "Could not create file: " + specFile.fsName
            };
        }

    } catch (error) {
        DEBUG.error("File Write Failed", error);
        return {
            success: false,
            error: "File operation failed: " + error.toString(),
            details: "Check permissions for ~/Documents/MotionSpecs/inbox/"
        };
    }
}

function checkFileSystemAccess() {
    try {
        DEBUG.log("Testing file system access for bridge communication");

        // Test if we can access the motion specs folder
        var homeFolder = Folder("~");
        var motionSpecsFolder = new Folder(homeFolder.fsName + "/Documents/MotionSpecs");
        var inboxFolder = new Folder(motionSpecsFolder.fsName + "/inbox");

        // Try to create the folder structure if it doesn't exist
        if (!motionSpecsFolder.exists) {
            if (!motionSpecsFolder.create()) {
                return {
                    ready: false,
                    error: "Cannot create MotionSpecs folder",
                    path: motionSpecsFolder.fsName
                };
            }
        }

        if (!inboxFolder.exists) {
            if (!inboxFolder.create()) {
                return {
                    ready: false,
                    error: "Cannot create inbox folder",
                    path: inboxFolder.fsName
                };
            }
        }

        // Test write permissions by creating a temporary test file
        var testFile = new File(inboxFolder.fsName + "/test_" + new Date().getTime() + ".tmp");

        try {
            testFile.open("w");
            testFile.write("test");
            testFile.close();

            if (testFile.exists) {
                testFile.remove(); // Clean up test file
                return {
                    ready: true,
                    status: "File system accessible",
                    inboxPath: inboxFolder.fsName
                };
            } else {
                return {
                    ready: false,
                    error: "Cannot write to inbox folder",
                    path: inboxFolder.fsName
                };
            }
        } catch (writeError) {
            return {
                ready: false,
                error: "Write permission denied: " + writeError.toString(),
                path: inboxFolder.fsName
            };
        }

    } catch (error) {
        return {
            ready: false,
            error: "File system access failed: " + error.toString()
        };
    }
}

// Animation counting and preview functions
function countSelectedAnimations() {
    DEBUG.log("=== COUNTING SELECTED ANIMATIONS ===");

    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
        DEBUG.log("No active composition");
        return { layers: 0, animations: 0, details: [] };
    }

    DEBUG.log("Active comp: " + comp.name);

    var selectedLayers = comp.selectedLayers;
    DEBUG.log("Selected layers: " + selectedLayers.length);

    if (selectedLayers.length === 0) {
        DEBUG.log("No layers selected");
        return { layers: 0, animations: 0, details: [] };
    }

    var totalAnimations = 0;
    var layerDetails = [];

    for (var i = 0; i < selectedLayers.length; i++) {
        var layer = selectedLayers[i];

        try {
            // Include all layers, even guide layers
            var isGuide = layer.isGuideLayer ? " (GUIDE)" : "";
            DEBUG.log("Checking layer: " + layer.name + isGuide + " (type: " + getLayerType(layer) + ")");

            var selectedProperties = findPropertiesWithSelectedKeyframes(layer);
            DEBUG.log("  Found " + selectedProperties.length + " properties with selected keyframes");

            if (selectedProperties.length > 0) {
                totalAnimations += selectedProperties.length;
                layerDetails.push({
                    name: layer.name,
                    animations: selectedProperties.length,
                    properties: selectedProperties.map(function(p) { return p.name; }),
                    layerType: getLayerType(layer)
                });
            }
        } catch (layerError) {
            DEBUG.error("Error counting animations for layer " + layer.name, layerError);
            // Continue with other layers
        }
    }

    DEBUG.log("=== RESULT: " + totalAnimations + " animations from " + layerDetails.length + " layers ===");

    return {
        layers: layerDetails.length,
        animations: totalAnimations,
        details: layerDetails
    };
}

// Utility functions
function roundMs(seconds) {
    var ms = seconds * 1000;
    if (Math.abs(ms) < 0.5) return 0;
    return Math.round(ms);
}

function roundPx(pixels) {
    if (Math.abs(pixels) < 0.5) return 0;
    return Math.round(pixels); // Always returns integer
}

// Sanitize layer names to remove problematic Unicode characters
function sanitizeLayerName(layerName) {
    if (!layerName) return layerName;

    // Remove common plugin prefixes with special characters
    // Void plugin uses "▣ " prefix
    var sanitized = layerName.replace(/^[▣\u25A3]\s+/, ''); // Remove box character + space

    // Remove other potentially problematic Unicode characters while keeping common ones
    // Keep: letters, numbers, spaces, basic punctuation, hyphens, underscores
    sanitized = sanitized.replace(/[^\u0020-\u007E\u00A0-\u00FF]/g, '');

    // Trim any leading/trailing whitespace
    sanitized = sanitized.replace(/^\s+|\s+$/g, '');

    return sanitized || layerName; // Fallback to original if everything was stripped
}

// Expression detection and parsing
function parseExpression(expressionText) {
    if (!expressionText || expressionText === "") return null;

    var patterns = [
        /thisComp\.layer\(["']([^"']+)["']\)\.(?:transform\.)?(\w+)/i,
        /thisComp\.layer\((\d+)\)\.(?:transform\.)?(\w+)/i,
        /comp\(["']([^"']+)["']\)\.layer\(["']([^"']+)["']\)\.(?:transform\.)?(\w+)/i
    ];

    for (var i = 0; i < patterns.length; i++) {
        var match = expressionText.match(patterns[i]);
        if (match) {
            var result = {
                type: 'layer_reference',
                sourceLayer: match[1],
                property: match[match.length - 1]
            };
            if (patterns[i].toString().indexOf('comp\\(') !== -1) {
                result.sourceComp = match[1];
                result.sourceLayer = match[2];
            }
            DEBUG.log("Parsed expression: " + JSON.stringify(result));
            return result;
        }
    }
    return null;
}

function findLayerByNameOrIndex(comp, layerIdentifier) {
    if (/^\d+$/.test(layerIdentifier)) {
        var index = parseInt(layerIdentifier);
        if (index > 0 && index <= comp.numLayers) {
            return comp.layer(index);
        }
    }
    for (var i = 1; i <= comp.numLayers; i++) {
        try {
            var layer = comp.layer(i);
            if (layer.name === layerIdentifier) {
                return layer;
            }
        } catch (e) {}
    }
    return null;
}

function checkForLinkedAnimations(layer, comp) {
    var linkedAnimations = [];
    try {
        var propertiesToCheck = [
            { prop: layer.transform.position, name: "Position", matchName: "ADBE Position" },
            { prop: layer.transform.xPosition, name: "X Position", matchName: "ADBE Position_0" },
            { prop: layer.transform.yPosition, name: "Y Position", matchName: "ADBE Position_1" },
            { prop: layer.transform.scale, name: "Scale", matchName: "ADBE Scale" },
            { prop: layer.transform.rotation, name: "Rotation", matchName: "ADBE Rotate Z" },
            { prop: layer.transform.opacity, name: "Opacity", matchName: "ADBE Opacity" }
        ];

        for (var i = 0; i < propertiesToCheck.length; i++) {
            try {
                var propInfo = propertiesToCheck[i];
                var prop = propInfo.prop;

                if (prop && prop.expressionEnabled && prop.expression) {
                    DEBUG.log("Found expression on " + layer.name + "." + propInfo.name);
                    var parsed = parseExpression(prop.expression);
                    if (parsed && parsed.type === 'layer_reference') {
                        var sourceLayer = findLayerByNameOrIndex(comp, parsed.sourceLayer);
                        if (sourceLayer) {
                            var sourceProps = findPropertiesWithSelectedKeyframes(sourceLayer);
                            for (var j = 0; j < sourceProps.length; j++) {
                                var sourceProp = sourceProps[j];
                                if (sourceProp.matchName.toLowerCase().indexOf(parsed.property.toLowerCase()) !== -1 ||
                                    parsed.property.toLowerCase().indexOf(sourceProp.name.toLowerCase()) !== -1) {
                                    linkedAnimations.push({
                                        targetLayer: layer.name,
                                        targetProperty: propInfo.name,
                                        sourceLayer: sourceLayer.name,
                                        sourceProperty: sourceProp.name,
                                        sourcePropertyInfo: sourceProp,
                                        expressionLink: true
                                    });
                                    DEBUG.log("Linked: " + layer.name + "." + propInfo.name + " → " + sourceLayer.name + "." + sourceProp.name);
                                }
                            }
                        }
                    }
                }
            } catch (propError) {
                DEBUG.log("Error checking property: " + propError);
            }
        }
    } catch (e) {
        DEBUG.log("Error checking linked animations: " + e);
    }
    return linkedAnimations;
}

// Composition analysis and resolution detection
function detectCompositionMultiplier(comp) {
    // Check if user has manually overridden the scale
    if (MOTION_SPEC_CONFIG.SCALE_OVERRIDE > 0) {
        DEBUG.log("Using manual scale override: " + MOTION_SPEC_CONFIG.SCALE_OVERRIDE + "x");
        return MOTION_SPEC_CONFIG.SCALE_OVERRIDE;
    }

    var width = comp.width;
    var height = comp.height;

    DEBUG.log("Composition dimensions: " + width + "x" + height);
    DEBUG.log("Auto-detecting scale multiplier...");

    // Common resolution patterns
    var resolutionPatterns = [
        { multiplier: 1, widths: [375, 390, 414, 428, 393], heights: [667, 844, 896, 926, 852] }, // 1x iOS
        { multiplier: 2, widths: [750, 780, 828, 856, 786], heights: [1334, 1688, 1792, 1852, 1704] }, // 2x iOS
        { multiplier: 3, widths: [1125, 1170, 1242, 1284, 1179], heights: [2001, 2532, 2688, 2778, 2556] }, // 3x iOS
        { multiplier: 1, widths: [360, 411, 393, 412], heights: [640, 731, 786, 915] }, // 1x Android
        { multiplier: 2, widths: [720, 822, 786, 824], heights: [1280, 1462, 1572, 1830] }, // 2x Android
        { multiplier: 3, widths: [1080, 1233, 1179, 1236], heights: [1920, 2193, 2358, 2745] } // 3x Android
    ];

    for (var i = 0; i < resolutionPatterns.length; i++) {
        var pattern = resolutionPatterns[i];
        for (var j = 0; j < pattern.widths.length; j++) {
            if (Math.abs(width - pattern.widths[j]) <= 5 && Math.abs(height - pattern.heights[j]) <= 5) {
                DEBUG.log("Auto-detected " + pattern.multiplier + "x resolution pattern");
                return pattern.multiplier;
            }
        }
    }

    // Fallback: assume 1x
    DEBUG.log("No specific resolution pattern detected, assuming 1x");
    return 1;
}

// Find properties with selected keyframes - with precomp support
function findPropertiesWithSelectedKeyframes(layer) {
    var propertiesWithSelected = [];

    try {
        DEBUG.log("Analyzing layer: " + layer.name + " (type: " + getLayerType(layer) + ")");

        // Check if this is a precomp layer and handle it specially
        if (isPrecompLayer(layer)) {
            DEBUG.log("Layer is a precomp - checking animatable properties");
            // For precomps, search both layer properties and transform properties
            // Some properties might be directly on the layer, others in transform group
            searchPropertiesWithSafety(layer, 0);
        } else {
            // For regular layers, search all properties as usual
            searchPropertiesWithSafety(layer, 0);
        }

    } catch (error) {
        DEBUG.error("Error analyzing layer " + layer.name, error);
        // Try to fall back to transform-only for safety
        try {
            DEBUG.log("Fallback: trying transform properties only");
            searchPropertiesWithSafety(layer.transform, 0);
        } catch (fallbackError) {
            DEBUG.error("Fallback also failed for layer " + layer.name, fallbackError);
        }
    }

    function searchPropertiesWithSafety(propGroup, depth) {
        depth = depth || 0;
        var indent = "";
        for (var d = 0; d < depth; d++) indent += "  ";

        try {
            if (!propGroup || typeof propGroup.numProperties === 'undefined') {
                DEBUG.log(indent + "Invalid property group, skipping");
                return;
            }

            for (var i = 1; i <= propGroup.numProperties; i++) {
                var prop = null;
                try {
                    prop = propGroup.property(i);
                } catch (propError) {
                    DEBUG.log(indent + "Could not access property " + i + ": " + propError);
                    continue;
                }

                if (!prop) continue;

                try {
                    DEBUG.log(indent + "Checking: " + prop.name + " (matchName: " + prop.matchName + ", canVary: " + prop.canVaryOverTime + ", keys: " + prop.numKeys + ")");

                    if (prop.canVaryOverTime && prop.numKeys > 0) {
                        var selectedCount = 0;
                        var allKeyInfo = [];
                        for (var j = 1; j <= prop.numKeys; j++) {
                            try {
                                var isSelected = prop.keySelected(j);
                                var keyTime = prop.keyTime(j);
                                allKeyInfo.push("Key " + j + ": " + (isSelected ? "SELECTED" : "not selected") + " at " + keyTime.toFixed(3) + "s");
                                if (isSelected) {
                                    selectedCount++;
                                }
                            } catch (keyError) {
                                DEBUG.log(indent + "  Error checking key " + j + ": " + keyError);
                            }
                        }

                        DEBUG.log(indent + "  Keys: " + allKeyInfo.join(", "));
                        DEBUG.log(indent + "  → " + selectedCount + " selected keyframes found");

                        if (selectedCount > 0) {
                            DEBUG.log(indent + "  ADDED: " + prop.name + " (" + prop.matchName + ") with " + selectedCount + " selected keys");
                            propertiesWithSelected.push({
                                property: prop,
                                name: prop.name,
                                matchName: prop.matchName,
                                numKeys: prop.numKeys,
                                selectedKeys: selectedCount
                            });
                        }
                    } else if (prop.numKeys > 0) {
                        DEBUG.log(indent + "  Property has " + prop.numKeys + " keyframes but none selected");
                    } else {
                        DEBUG.log(indent + "  (No keyframes on this property)");
                    }

                    // Recursively search nested properties with safety check
                    if (prop.numProperties && prop.numProperties > 0) {
                        searchPropertiesWithSafety(prop, depth + 1);
                    }
                } catch (propAnalysisError) {
                    DEBUG.log(indent + "Error analyzing property " + prop.name + ": " + propAnalysisError);
                }
            }
        } catch (groupError) {
            DEBUG.error("Error searching property group", groupError);
        }
    }

    DEBUG.log("=== SEARCH COMPLETE for " + layer.name + " ===");
    DEBUG.log("Found " + propertiesWithSelected.length + " properties with selected keyframes:");
    for (var i = 0; i < propertiesWithSelected.length; i++) {
        DEBUG.log("  - " + propertiesWithSelected[i].name + " (" + propertiesWithSelected[i].matchName + "): " + propertiesWithSelected[i].selectedKeys + " selected keys");
    }
    DEBUG.log("==========================================");

    return propertiesWithSelected;
}

// Helper function to determine layer type
function getLayerType(layer) {
    try {
        if (layer.source && layer.source instanceof CompItem) {
            return "precomp";
        } else if (layer.source && layer.source instanceof FootageItem) {
            return "footage";
        } else if (layer.matchName === "ADBE Text Layer") {
            return "text";
        } else if (layer.matchName === "ADBE Vector Layer") {
            return "shape";
        } else if (layer.nullLayer) {
            return "null";
        } else {
            return "unknown";
        }
    } catch (error) {
        return "unknown";
    }
}

// Helper function to check if layer is a precomp
function isPrecompLayer(layer) {
    try {
        return layer.source && layer.source instanceof CompItem;
    } catch (error) {
        return false;
    }
}

// Extract property values from selected keyframes
function extractPropertyValues(prop, multiplier) {
    var values = {
        startValue: null,
        endValue: null,
        change: null,
        type: "unknown",
        formatted: {}
    };

    var selectedKeyframes = [];
    for (var i = 1; i <= prop.numKeys; i++) {
        if (prop.keySelected(i)) {
            selectedKeyframes.push({
                index: i,
                time: prop.keyTime(i),
                value: prop.keyValue(i)
            });
        }
    }

    if (selectedKeyframes.length < 2) return values;

    var startKey = selectedKeyframes[0];
    var endKey = selectedKeyframes[selectedKeyframes.length - 1];

    // Handle different property types
    if (prop.name.indexOf("Position") !== -1) {
        values.type = "position";

        // Check if this is a combined Position property (array) or split X/Y Position (single value)
        if (typeof startKey.value === "object" && startKey.value.length >= 2) {
            // Combined Position property - check if X and Y actually animate
            var startX = startKey.value[0] / multiplier;
            var startY = startKey.value[1] / multiplier;
            var endX = endKey.value[0] / multiplier;
            var endY = endKey.value[1] / multiplier;

            var changeX = endX - startX;
            var changeY = endY - startY;

            // Mark which axes actually animate (have significant change)
            var xAnimates = Math.abs(changeX) > 0.5; // More than 0.5px change
            var yAnimates = Math.abs(changeY) > 0.5;

            values.startValue = [roundPx(startX), roundPx(startY)];
            values.endValue = [roundPx(endX), roundPx(endY)];
            values.change = [roundPx(changeX), roundPx(changeY)];

            // Add metadata about which axes animate
            values.animatingAxes = {
                x: xAnimates,
                y: yAnimates,
                both: xAnimates && yAnimates,
                neither: !xAnimates && !yAnimates
            };

            values.formatted = {
                startValue: "(" + roundPx(startX) + "px, " + roundPx(startY) + "px)",
                endValue: "(" + roundPx(endX) + "px, " + roundPx(endY) + "px)",
                change: (changeX >= 0 ? "+" : "") + roundPx(changeX) + "px, " +
                       (changeY >= 0 ? "+" : "") + roundPx(changeY) + "px"
            };
        } else {
            // Split X Position or Y Position property - single value
            var startVal = startKey.value / multiplier;
            var endVal = endKey.value / multiplier;
            var changeVal = endVal - startVal;

            values.startValue = roundPx(startVal);
            values.endValue = roundPx(endVal);
            values.change = roundPx(changeVal);

            var axis = prop.name.indexOf("X Position") !== -1 ? "X" : "Y";
            values.formatted = {
                startValue: roundPx(startVal) + "px (" + axis + ")",
                endValue: roundPx(endVal) + "px (" + axis + ")",
                change: (changeVal >= 0 ? "+" : "") + roundPx(changeVal) + "px (" + axis + ")"
            };
        }
    } else if (prop.name.indexOf("Scale") !== -1) {
        values.type = "scale";
        if (typeof startKey.value === "object" && startKey.value.length >= 2) {
            values.startValue = [startKey.value[0], startKey.value[1]];
            values.endValue = [endKey.value[0], endKey.value[1]];
            values.change = [endKey.value[0] - startKey.value[0], endKey.value[1] - startKey.value[1]];

            values.formatted = {
                startValue: startKey.value[0] + "%, " + startKey.value[1] + "%",
                endValue: endKey.value[0] + "%, " + endKey.value[1] + "%",
                change: (endKey.value[0] - startKey.value[0] >= 0 ? "+" : "") +
                       (endKey.value[0] - startKey.value[0]) + "% scale"
            };
        }
    } else if (prop.name.indexOf("Opacity") !== -1 || prop.name.indexOf("opacity") !== -1) {
        // Opacity property - values are 0-100
        values.type = "opacity";
        values.startValue = startKey.value;
        values.endValue = endKey.value;
        values.change = endKey.value - startKey.value;
        values.formatted = {
            startValue: Math.round(startKey.value) + "%",
            endValue: Math.round(endKey.value) + "%",
            change: (values.change >= 0 ? "+" : "") + Math.round(values.change) + "%"
        };
    } else if (prop.name.indexOf("Rotation") !== -1 || prop.name.indexOf("rotation") !== -1) {
        // Rotation property - values are in degrees
        values.type = "rotation";
        values.startValue = startKey.value;
        values.endValue = endKey.value;
        values.change = endKey.value - startKey.value;
        values.formatted = {
            startValue: Math.round(startKey.value) + "°",
            endValue: Math.round(endKey.value) + "°",
            change: (values.change >= 0 ? "+" : "") + Math.round(values.change) + "°"
        };
    } else {
        // Handle single-value properties
        var isCornerProperty = (prop.name.toLowerCase().indexOf("tl") !== -1 ||
                               prop.name.toLowerCase().indexOf("tr") !== -1 ||
                               prop.name.toLowerCase().indexOf("bl") !== -1 ||
                               prop.name.toLowerCase().indexOf("br") !== -1 ||
                               prop.name.toLowerCase().indexOf("unified radius") !== -1 ||
                               prop.name.toLowerCase().indexOf("unified corners") !== -1 ||
                               prop.name.toLowerCase().indexOf("top left") !== -1 ||
                               prop.name.toLowerCase().indexOf("top right") !== -1 ||
                               prop.name.toLowerCase().indexOf("bottom left") !== -1 ||
                               prop.name.toLowerCase().indexOf("bottom right") !== -1 ||
                               prop.name.toLowerCase().indexOf("corner") !== -1 ||
                               prop.name.toLowerCase().indexOf("radius") !== -1 ||
                               prop.name.toLowerCase().indexOf("smoothing") !== -1);

        if (isCornerProperty) {
            // Apply device scaling to corner radius properties
            var startVal = startKey.value / multiplier;
            var endVal = endKey.value / multiplier;
            var changeVal = endVal - startVal;

            values.startValue = roundPx(startVal);
            values.endValue = roundPx(endVal);
            values.change = roundPx(changeVal);
            values.type = "corner_radius";
            values.formatted = {
                startValue: roundPx(startVal) + "px",
                endValue: roundPx(endVal) + "px",
                change: (changeVal >= 0 ? "+" : "") + roundPx(changeVal) + "px"
            };
        } else {
            // Check if this is a dimensional property (width/height) that needs scaling
            var isDimensionalProperty = (prop.name.toLowerCase().indexOf("width") !== -1 ||
                                        prop.name.toLowerCase().indexOf("height") !== -1 ||
                                        prop.name.toLowerCase().indexOf("size") !== -1 ||
                                        prop.name.toLowerCase().indexOf("distance") !== -1 ||
                                        prop.name.toLowerCase().indexOf("softness") !== -1);

            if (isDimensionalProperty) {
                // Apply device scaling to dimensional properties
                var startVal = startKey.value / multiplier;
                var endVal = endKey.value / multiplier;
                var changeVal = endVal - startVal;

                values.startValue = roundPx(startVal);
                values.endValue = roundPx(endVal);
                values.change = roundPx(changeVal);
                values.type = "dimensional";
                values.formatted = {
                    startValue: roundPx(startVal) + "px",
                    endValue: roundPx(endVal) + "px",
                    change: (changeVal >= 0 ? "+" : "") + roundPx(changeVal) + "px"
                };
            } else {
                // Handle other single-value properties (no scaling)
                values.startValue = startKey.value;
                values.endValue = endKey.value;
                values.change = endKey.value - startKey.value;

                values.formatted = {
                    startValue: startKey.value.toString(),
                    endValue: endKey.value.toString(),
                    change: (endKey.value - startKey.value >= 0 ? "+" : "") + (endKey.value - startKey.value)
                };
            }
        }
    }

    return values;
}

// Cubic bezier extraction from selected keyframes
function extractCubicBezierFromSelectedKeyframes(layer) {
    DEBUG.log("Extracting cubic bezier from selected keyframes on layer: " + layer.name);

    function searchPropsForSelectedKeyframes(propGroup, groupName) {
        for (var i = 1; i <= propGroup.numProperties; i++) {
            var prop = propGroup.property(i);
            if (!prop) continue;

            if (prop.canVaryOverTime && prop.numKeys > 0) {
                var selectedKeyframes = [];

                for (var j = 1; j <= prop.numKeys; j++) {
                    var isSelected = prop.keySelected(j);
                    var inInterp = prop.keyInInterpolationType(j);
                    var outInterp = prop.keyOutInterpolationType(j);
                    var isBezier = (inInterp === KeyframeInterpolationType.BEZIER || outInterp === KeyframeInterpolationType.BEZIER);

                    if (isSelected && isBezier) {
                        selectedKeyframes.push({
                            index: j,
                            time: prop.keyTime(j),
                            inEase: prop.keyInTemporalEase(j),
                            outEase: prop.keyOutTemporalEase(j)
                        });
                    }
                }

                if (selectedKeyframes.length >= 2) {
                    var firstKey = selectedKeyframes[0];
                    var secondKey = selectedKeyframes[1];

                    if (firstKey.outEase && secondKey.inEase &&
                        firstKey.outEase.length > 0 && secondKey.inEase.length > 0) {

                        var outEaseData = firstKey.outEase[0];
                        var inEaseData = secondKey.inEase[0];

                        if (outEaseData && inEaseData &&
                            typeof outEaseData.influence != 'undefined' && typeof outEaseData.speed != 'undefined' &&
                            typeof inEaseData.influence != 'undefined' && typeof inEaseData.speed != 'undefined') {

                            var x1 = outEaseData.influence / 100;
                            var y1 = outEaseData.speed / 100;
                            var x2 = 1 - (inEaseData.influence / 100);
                            var y2 = 1 - (inEaseData.speed / 100);

                            x1 = Math.max(0, Math.min(1, x1));
                            y1 = Math.max(0, Math.min(1, y1));
                            x2 = Math.max(0, Math.min(1, x2));
                            y2 = Math.max(0, Math.min(1, y2));

                            x1 = Math.round(x1 * 1000) / 1000;
                            y1 = Math.round(y1 * 1000) / 1000;
                            x2 = Math.round(x2 * 1000) / 1000;
                            y2 = Math.round(y2 * 1000) / 1000;

                            var cssFormat = "cubic-bezier(" + x1.toFixed(3) + ", " + y1.toFixed(3) + ", " + x2.toFixed(3) + ", " + y2.toFixed(3) + ")";
                            DEBUG.log("SUCCESS: Created cubic-bezier: " + cssFormat);
                            return cssFormat;
                        }
                    }
                }
            }

            if (prop.numProperties > 0) {
                var result = searchPropsForSelectedKeyframes(prop, prop.name);
                if (result) return result;
            }
        }
        return null;
    }

    var result = searchPropsForSelectedKeyframes(layer, layer.name);
    if (result) return result;

    return searchPropsForSelectedKeyframes(layer.transform, "Transform");
}

// Spring marker parsing functions
function parseAllSpringsFromMarker(markerComment) {
    var springs = [];

    try {
        var cleanedComment = markerComment.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        var allLines = cleanedComment.split('\n');
        var lines = [];

        for (var i = 0; i < allLines.length; i++) {
            var line = allLines[i].trim();
            if (line.length > 0) {
                lines.push(line);
            }
        }

        var i = 0;
        while (i < lines.length) {
            var currentLine = lines[i];

            if (currentLine.indexOf('Spring') !== -1 || currentLine.indexOf('Custom') !== -1) {
                var springData = {
                    preset: currentLine.trim(),
                    custom: null,
                    property: null
                };

                if (i + 1 < lines.length) {
                    var paramLine = lines[i + 1];
                    if (paramLine.indexOf('Stiffness:') !== -1) {
                        DEBUG.log("Parsing parameter line: '" + paramLine + "'");

                        var stiffnessMatch = paramLine.match(/Stiffness:\s*([0-9.]+)/);
                        var dampingMatch = paramLine.match(/Damping:\s*([0-9.]+)/);
                        var dampingRatioMatch = paramLine.match(/Damping Ratio:\s*([0-9.]+)/);
                        var massMatch = paramLine.match(/Mass:\s*([0-9.]+)/);

                        DEBUG.log("Regex matches - Stiffness: " + (stiffnessMatch ? stiffnessMatch[1] : "null") +
                                 ", Damping: " + (dampingMatch ? dampingMatch[1] : "null") +
                                 ", Damping Ratio: " + (dampingRatioMatch ? dampingRatioMatch[1] : "null") +
                                 ", Mass: " + (massMatch ? massMatch[1] : "null"));

                        if (stiffnessMatch && dampingMatch) {
                            springData.custom = {
                                stiffness: parseFloat(stiffnessMatch[1]),
                                damping: parseFloat(dampingMatch[1])
                            };

                            // Add optional Sproing parameters if present
                            if (dampingRatioMatch) {
                                springData.custom.dampingRatio = parseFloat(dampingRatioMatch[1]);
                            }
                            if (massMatch) {
                                springData.custom.mass = parseFloat(massMatch[1]);
                            }

                            DEBUG.log("SUCCESS: Extracted spring params for " + springData.preset + ": stiffness=" + springData.custom.stiffness +
                                    ", damping=" + springData.custom.damping +
                                    (springData.custom.dampingRatio ? ", dampingRatio=" + springData.custom.dampingRatio : "") +
                                    (springData.custom.mass ? ", mass=" + springData.custom.mass : ""));
                        } else {
                            DEBUG.log("FAILED: Could not extract parameters from: " + paramLine);
                        }
                        i++; // Skip parameter line
                    }

                    if (i + 1 < lines.length) {
                        var propLine = lines[i + 1];
                        if (propLine.indexOf('Property:') !== -1) {
                            // Handle both "Property:" and "| Property:" formats
                            var property = propLine.replace('Property:', '').replace('|', '').trim();
                            springData.property = property;
                            DEBUG.log("Extracted property from marker: '" + property + "'");
                            i++; // Skip property line
                        }
                    }
                }

                springs.push(springData);
            }
            i++;
        }

        DEBUG.log("Total springs parsed: " + springs.length);
        for (var j = 0; j < springs.length; j++) {
            DEBUG.log("Spring " + j + ": " + springs[j].preset + " for property: " + (springs[j].property || "none"));
        }

    } catch (error) {
        DEBUG.error("Error parsing springs from marker", error);
    }

    return springs;
}

function findSpringForProperty(springs, propertyName) {
    // First pass: exact matchName match (old Sproing format)
    for (var i = 0; i < springs.length; i++) {
        var spring = springs[i];
        if (spring.property && spring.property === propertyName) {
            return spring;
        }
    }

    // Second pass: path-based match (new Sproing format with full property path)
    // Marker may contain "4/1/2/Pseudo/85866-0002" while propertyName is "Pseudo/85866-0002"
    for (var i = 0; i < springs.length; i++) {
        var spring = springs[i];
        if (spring.property && spring.property.indexOf(propertyName) !== -1) {
            // Check if marker property ends with the matchName
            var endsWithMatch = spring.property.substring(spring.property.length - propertyName.length) === propertyName;
            if (endsWithMatch) {
                DEBUG.log("MATCHED spring via path: marker='" + spring.property + "' matches property='" + propertyName + "'");
                return spring;
            }
        }
    }

    // Third pass: fallback to any spring without specific property
    for (var i = 0; i < springs.length; i++) {
        var spring = springs[i];
        if (!spring.property) {
            return spring;
        }
    }

    return null;
}

// Detect baked springs (original - analyzes entire property)
function detectBakedSpring(prop) {
    if (!prop || !prop.canVaryOverTime || prop.numKeys < 15) {
        return null;
    }

    var keyframeDensity = prop.numKeys / prop.comp.duration;

    if (keyframeDensity >= 15) {
        return {
            detected: true,
            density: keyframeDensity,
            classification: keyframeDensity > 30 ? "Fast Spring" :
                          keyframeDensity > 20 ? "Standard Spring" : "Gentle Spring"
        };
    }

    return null;
}

// Detect baked springs ONLY in selected keyframe time range
function detectBakedSpringInRange(prop, startTime, endTime) {
    if (!prop || !prop.canVaryOverTime || prop.numKeys < 2) {
        return null;
    }

    // Count keyframes within the selected time range
    var keysInRange = 0;
    for (var i = 1; i <= prop.numKeys; i++) {
        var keyTime = prop.keyTime(i);
        if (keyTime >= startTime && keyTime <= endTime) {
            keysInRange++;
        }
    }

    // Need sufficient density of keyframes in the range to detect baked spring
    var rangeDuration = endTime - startTime;
    var keyframeDensity = keysInRange / rangeDuration;


    // Much stricter threshold - only detect true baked springs, not manual keyframes
    // Baked springs typically have 24+ fps worth of keyframes, so use high density requirement
    if (keysInRange >= 20 && keyframeDensity >= 20) {
        return {
            detected: true,
            density: keyframeDensity,
            keysInRange: keysInRange,
            classification: keyframeDensity > 30 ? "Fast Spring" :
                          keyframeDensity > 25 ? "Standard Spring" : "Gentle Spring"
        };
    }

    return null;
}

// Per-property cubic bezier extraction (more precise than layer-level detection)
function extractCubicBezierFromSelectedKeyframesForProperty(layer, targetProp) {
    DEBUG.log("Extracting cubic bezier from selected keyframes for property: " + targetProp.name);

    if (!targetProp.canVaryOverTime || targetProp.numKeys < 2) {
        DEBUG.log("Property " + targetProp.name + " cannot vary over time or has insufficient keyframes");
        return null;
    }

    var selectedKeyframes = [];
    var totalKeys = 0;
    var selectedCount = 0;
    var bezierCount = 0;

    for (var j = 1; j <= targetProp.numKeys; j++) {
        totalKeys++;
        var isSelected = targetProp.keySelected(j);
        var inInterp = targetProp.keyInInterpolationType(j);
        var outInterp = targetProp.keyOutInterpolationType(j);
        var isBezier = (inInterp === KeyframeInterpolationType.BEZIER || outInterp === KeyframeInterpolationType.BEZIER);

        if (isSelected) selectedCount++;
        if (isBezier) bezierCount++;

        if (isSelected && isBezier) {
            DEBUG.log("Found selected bezier keyframe " + j + " on " + targetProp.name + " at time " + targetProp.keyTime(j));
            selectedKeyframes.push({
                index: j,
                time: targetProp.keyTime(j),
                inEase: targetProp.keyInTemporalEase(j),
                outEase: targetProp.keyOutTemporalEase(j)
            });
        }
    }

    DEBUG.log("Property " + targetProp.name + ": " + totalKeys + " total keys, " + selectedCount + " selected, " + bezierCount + " bezier, " + selectedKeyframes.length + " selected bezier");

    if (selectedKeyframes.length >= 2) {
        var firstKey = selectedKeyframes[0];
        var secondKey = selectedKeyframes[1];

        DEBUG.log("Creating transition cubic-bezier from keyframe " + firstKey.index + " to " + secondKey.index);

        if (firstKey.outEase && secondKey.inEase &&
            firstKey.outEase.length > 0 && secondKey.inEase.length > 0) {

            var outEaseData = firstKey.outEase[0];
            var inEaseData = secondKey.inEase[0];

            if (outEaseData && inEaseData &&
                typeof outEaseData.influence != 'undefined' && typeof outEaseData.speed != 'undefined' &&
                typeof inEaseData.influence != 'undefined' && typeof inEaseData.speed != 'undefined') {

                // Convert AE temporal ease to CSS cubic-bezier format
                // AE influence is % (0-100), speed is % (0-100)
                // CSS cubic-bezier expects values 0-1

                // First control point (outgoing ease from first keyframe)
                var x1 = outEaseData.influence / 100;
                var y1 = outEaseData.speed / 100;

                // Second control point (incoming ease to second keyframe)
                var x2 = 1 - (inEaseData.influence / 100);
                var y2 = 1 - (inEaseData.speed / 100);

                // Clamp values to valid range
                x1 = Math.max(0, Math.min(1, x1));
                y1 = Math.max(0, Math.min(1, y1));
                x2 = Math.max(0, Math.min(1, x2));
                y2 = Math.max(0, Math.min(1, y2));

                // Round to 2 decimal places for clean output
                x1 = Math.round(x1 * 100) / 100;
                y1 = Math.round(y1 * 100) / 100;
                x2 = Math.round(x2 * 100) / 100;
                y2 = Math.round(y2 * 100) / 100;

                var cssFormat = "cubic-bezier(" + x1.toFixed(2) + ", " + y1.toFixed(2) + ", " + x2.toFixed(2) + ", " + y2.toFixed(2) + ")";
                DEBUG.log("SUCCESS: Created cubic-bezier for " + targetProp.name + ": " + cssFormat);
                DEBUG.log("From outEase: influence=" + outEaseData.influence + ", speed=" + outEaseData.speed);
                DEBUG.log("From inEase: influence=" + inEaseData.influence + ", speed=" + inEaseData.speed);
                return cssFormat;
            }
        }
    }

    DEBUG.log("No valid cubic-bezier found for property: " + targetProp.name);
    return null;
}

// Walk up the parent chain to find an ancestor with animating transform properties
// This handles multi-level parenting (grandparent, great-grandparent, etc.)
function findAnimatingAncestor(layer) {
    if (!layer || !layer.parent) {
        return null;
    }

    var current = layer.parent;
    var parentChain = []; // Track the chain for debugging

    while (current) {
        parentChain.push(current.name);

        // Check if this ancestor has animating transform properties
        var animatingProps = [];
        var transformProps = [
            { prop: current.transform.position, name: "position" },
            { prop: current.transform.rotation, name: "rotation" },
            { prop: current.transform.scale, name: "scale" }
        ];

        for (var i = 0; i < transformProps.length; i++) {
            var propCheck = transformProps[i];
            try {
                if (propCheck.prop && propCheck.prop.canVaryOverTime && propCheck.prop.numKeys > 0) {
                    animatingProps.push(propCheck.name);
                }
            } catch (e) {}
        }

        if (animatingProps.length > 0) {
            DEBUG.log("Found animating ancestor for " + layer.name + ": " + current.name + " via chain: " + parentChain.join(" -> "));
            return {
                ancestor: current,
                ancestorName: current.name,
                animatingProperties: animatingProps,
                isDirectParent: (layer.parent.index === current.index),
                parentChain: parentChain
            };
        }

        current = current.parent;
    }

    DEBUG.log("No animating ancestor found for " + layer.name + " (checked chain: " + parentChain.join(" -> ") + ")");
    return null;
}

// Find child layers parented to this layer that are also selected
function findChildLayers(parentLayer, comp, selectedLayers) {
    if (!parentLayer || !comp) {
        DEBUG.log("findChildLayers: Missing parentLayer or comp");
        return [];
    }

    DEBUG.log("=== SEARCHING FOR CHILDREN OF: " + parentLayer.name + " (only selected children) ===");

    var children = [];

    try {
        // Check which properties are animating on the parent
        var animatingProperties = [];

        // Check transform properties
        var transformProps = [
            { prop: parentLayer.transform.position, name: "position" },
            { prop: parentLayer.transform.rotation, name: "rotation" },
            { prop: parentLayer.transform.scale, name: "scale" }
        ];

        for (var i = 0; i < transformProps.length; i++) {
            var propCheck = transformProps[i];
            try {
                if (propCheck.prop && propCheck.prop.canVaryOverTime && propCheck.prop.numKeys > 0) {
                    animatingProperties.push(propCheck.name);
                    DEBUG.log("Parent has animated " + propCheck.name + " (" + propCheck.prop.numKeys + " keys)");
                }
            } catch (propError) {
                DEBUG.log("Could not check " + propCheck.name + ": " + propError);
            }
        }

        // Note: Opacity is NOT inherited via AE parenting - only transforms (position, rotation, scale)
        // So we don't check parent opacity for inheritance

        DEBUG.log("Parent has " + animatingProperties.length + " inheritable transform properties: " + animatingProperties.join(", "));

        // Only proceed if parent has animating properties
        if (animatingProperties.length === 0) {
            DEBUG.log("No animating properties on parent, skipping child search");
            return [];
        }

        // Search all layers in comp for children parented to this layer
        DEBUG.log("Searching " + comp.numLayers + " layers for children...");
        for (var i = 1; i <= comp.numLayers; i++) {
            try {
                var layer = comp.layer(i);
                DEBUG.log("Checking layer " + i + ": " + layer.name + " (has parent: " + (layer.parent ? "YES" : "NO") + ")");

                if (layer.parent) {
                    DEBUG.log("  -> Parent is: " + layer.parent.name + " (index: " + layer.parent.index + "), looking for index: " + parentLayer.index);

                    if (layer.parent.index === parentLayer.index) {
                        // Check if this child layer is in the selected layers array
                        var isSelected = false;
                        for (var s = 0; s < selectedLayers.length; s++) {
                            if (selectedLayers[s].index === layer.index) {
                                isSelected = true;
                                break;
                            }
                        }

                        if (!isSelected) {
                            DEBUG.log("SKIPPING CHILD: " + layer.name + " (not selected)");
                        } else if (layer.name.toLowerCase().indexOf("mask") !== -1) {
                            // Skip mask layers (technical/matte layers)
                            DEBUG.log("SKIPPING CHILD: " + layer.name + " (mask layer)");
                        } else {
                            // Check if this child has Fit to Shape effect - if so, skip it
                            // (it will be handled as a Fit to Shape spec, not normal parenting)
                            var hasFitToShape = detectFitToShapeEffect(layer);
                            if (hasFitToShape) {
                                DEBUG.log("SKIPPING CHILD: " + layer.name + " (has Fit to Shape effect)");
                            } else {
                                children.push({
                                    layer: layer,  // Include layer reference for extracting child's own animations
                                    layerName: sanitizeLayerName(layer.name),
                                    parentName: sanitizeLayerName(parentLayer.name),
                                    inheritedProperties: animatingProperties
                                });
                                DEBUG.log("FOUND CHILD: " + layer.name + " parented to " + parentLayer.name);
                            }
                        }
                    }
                }
            } catch (layerError) {
                DEBUG.log("Error checking layer " + i + ": " + layerError);
            }
        }

        DEBUG.log("=== FOUND " + children.length + " CHILDREN ===");
    } catch (error) {
        DEBUG.error("Error finding children for " + parentLayer.name, error);
    }

    return children;
}

// Detect and extract "Fit to shape" effect data from a layer
function detectFitToShapeEffect(layer) {
    try {
        // Check if layer has a parent (required for Fit to Shape)
        if (!layer.parent) {
            return null;
        }

        // Check for "Fit to shape" effect (or "Fit to shape - v3")
        var fitEffect = null;
        var effects = layer.property("ADBE Effect Parade");
        if (!effects) {
            return null;
        }

        for (var i = 1; i <= effects.numProperties; i++) {
            var effect = effects.property(i);
            var effectName = effect.name;

            if (effectName === "Fit to shape" || effectName === "Fit to shape - v3") {
                fitEffect = effect;
                break;
            }
        }

        if (!fitEffect) {
            return null;
        }

        DEBUG.log("Found Fit to shape effect on layer: " + layer.name);

        // Extract Alignment dropdown value
        var alignment = 1; // default: center
        try {
            var alignmentProp = fitEffect.property("Alignment");
            if (alignmentProp) {
                alignment = alignmentProp.value;
                DEBUG.log("  Alignment: " + alignment);
            }
        } catch (e) {
            DEBUG.log("  Could not read Alignment property: " + e);
        }

        // Extract Scale To dropdown value
        var scaleTo = 1; // default: width
        try {
            var scaleToProp = fitEffect.property("Scale To");
            if (scaleToProp) {
                scaleTo = scaleToProp.value;
                DEBUG.log("  Scale To: " + scaleTo);
            }
        } catch (e) {
            DEBUG.log("  Could not read Scale To property: " + e);
        }

        return {
            containerLayerName: sanitizeLayerName(layer.parent.name),
            alignment: alignment,
            scaleTo: scaleTo
        };

    } catch (error) {
        DEBUG.error("Error detecting Fit to shape effect on " + layer.name, error);
        return null;
    }
}

// Extract animation data for a single property
function extractAnimationData(layer, propInfo, comp, multiplier) {
    var prop = propInfo.property;
    var animationData = {
        property: propInfo.name,
        hasKeyframes: true,
        easing: { type: "linear", source: null },
        timing: { delay: 0, duration: 0 },
        values: null,
        movement: null
    };

    // Extract timing from selected keyframes
    var selectedTimes = [];
    for (var i = 1; i <= prop.numKeys; i++) {
        if (prop.keySelected(i)) {
            selectedTimes.push(prop.keyTime(i));
        }
    }

    if (selectedTimes.length >= 2) {
        var startTime = selectedTimes[0];
        var endTime = selectedTimes[selectedTimes.length - 1];
        var workAreaStart = comp.workAreaStart;

        animationData.timing = {
            delay: roundMs(startTime - workAreaStart),
            duration: roundMs(endTime - startTime)
        };
    }

    // Extract values
    animationData.values = extractPropertyValues(prop, multiplier);

    // Detect easing type with CORRECT PRIORITY: Springs → Baked Springs → Cubic Bezier → Linear
    var springFound = false;

    // 1. Check for spring markers FIRST (highest priority) - BUT ONLY within selected keyframe timeframe
    var markers = layer.marker;
    if (markers && markers.numKeys > 0 && selectedTimes.length >= 2) {
        var selectedStartTime = selectedTimes[0];
        var selectedEndTime = selectedTimes[selectedTimes.length - 1];


        for (var m = 1; m <= markers.numKeys; m++) {
            var markerTime = markers.keyTime(m);

            // Only consider markers within the selected keyframe time range
            if (markerTime >= selectedStartTime && markerTime <= selectedEndTime) {
                var marker = markers.keyValue(m);
                if (marker.comment) {
                    var springs = parseAllSpringsFromMarker(marker.comment);
                    var matchedSpring = findSpringForProperty(springs, propInfo.matchName);

                    if (matchedSpring) {
                        var springData = {
                            preset: matchedSpring.preset,
                            custom: matchedSpring.custom
                        };

                        // Fill in missing parameters with presets
                        if (SPRING_PRESETS[matchedSpring.preset]) {
                            var preset = SPRING_PRESETS[matchedSpring.preset];
                            if (!springData.custom) springData.custom = {};
                            if (!springData.custom.stiffness) springData.custom.stiffness = preset.stiffness;
                            if (!springData.custom.damping) springData.custom.damping = preset.damping;
                            if (!springData.custom.dampingRatio) springData.custom.dampingRatio = preset.dampingRatio;
                            if (!springData.custom.mass) springData.custom.mass = preset.mass;
                        }

                        animationData.easing = {
                            type: "spring",
                            spring: springData,
                            source: "marker"
                        };
                        springFound = true;
                        break;
                    }
                }
            } else {
            }
        }
    }

    // 2. Check for baked springs if no marker spring found - BUT ONLY in selected keyframe range
    // DISABLED for now to prioritize cubic-bezier detection for manual keyframes
    if (false && !springFound && selectedTimes.length >= 2) {
        var bakedSpring = detectBakedSpringInRange(prop, selectedTimes[0], selectedTimes[selectedTimes.length - 1]);
        if (bakedSpring) {
            animationData.easing = {
                type: "spring",
                spring: {
                    preset: bakedSpring.classification,
                    custom: SPRING_PRESETS[bakedSpring.classification] || {}
                },
                source: "baked"
            };
            springFound = true;
        } else {
        }
    }

    // 3. Check for cubic bezier ONLY if no springs found (per-property detection)
    if (!springFound) {
        var cubicBezier = extractCubicBezierFromSelectedKeyframesForProperty(layer, prop);
        if (cubicBezier) {
            animationData.easing = {
                type: "cubic-bezier",
                cubicBezier: cubicBezier,
                source: "keyframes"
            };
        }
        // else: remains as default "linear"
    }

    return animationData;
}

// Main export function - updated for HTTP
// Copy motion spec to clipboard only (for data inspection)
function copyMotionSpecToClipboard() {
    DEBUG.log("=== CLIPBOARD COPY FOR INSPECTION ===");

    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({success: false, error: "No composition selected"});
        }

        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            return JSON.stringify({success: false, error: "No layers selected"});
        }

        DEBUG.log("Copying from composition: " + comp.name);
        DEBUG.log("Selected layers: " + selectedLayers.length);

        // Use the same data generation logic as the export function
        var motionSpecData = buildMotionSpecData(comp, selectedLayers);
        if (!motionSpecData || !motionSpecData.layers || motionSpecData.layers.length === 0) {
            return JSON.stringify({success: false, error: "No animation data found"});
        }

        // Create JSON output
        var jsonOutput = JSON.stringify(motionSpecData, null, 2);
        DEBUG.log("Generated JSON (" + jsonOutput.length + " characters)");

        // Copy to clipboard using proven working approach
        var clipboardSuccess = false;

        try {
            var tempFile = new File(Folder.temp.fsName + "/motion_spec_clipboard.json");
            if (tempFile.open("w")) {
                tempFile.write(jsonOutput);
                tempFile.close();

                var clipboardCommand = 'cat "' + tempFile.fsName + '" | pbcopy';
                var cmdResult = system.callSystem(clipboardCommand);

                // Validate clipboard content
                var validateResult = system.callSystem("pbpaste | wc -c");
                if (validateResult && parseInt(validateResult) > 0) {
                    clipboardSuccess = true;
                }

                // Clean up temp file
                tempFile.remove();
            }
        } catch (clipboardError) {
            DEBUG.error("Clipboard copy failed", clipboardError);
        }

        if (clipboardSuccess) {
            return JSON.stringify({success: true, size: jsonOutput.length});
        } else {
            return JSON.stringify({success: false, error: "Clipboard operation failed"});
        }

    } catch (error) {
        DEBUG.error("Clipboard copy failed", error);
        return JSON.stringify({success: false, error: error.toString()});
    }
}

function exportMotionSpecToFigma() {
    DEBUG.log("=== FIGMA MOTION SPEC FILE EXPORT START ===");

    try {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return JSON.stringify({success: false, error: "No composition selected"});
        }

        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) {
            return JSON.stringify({success: false, error: "No layers selected"});
        }

        // Count animations first
        var animationCount = countSelectedAnimations();
        DEBUG.log("Batch contains: " + animationCount.animations + " animations across " + animationCount.layers + " layers");

        DEBUG.log("Proceeding with file-based export");

        // Build motion spec data (using existing extraction logic)
        var motionSpec = buildMotionSpecData(comp, selectedLayers);

        // Send via file instead of HTTP
        var result = sendToFigmaViaFile(motionSpec);

        if (result.success) {
            DEBUG.log("Export completed successfully");
            return JSON.stringify({
                success: true,
                fileName: result.fileName,
                fileSize: result.fileSize,
                animationCount: animationCount.animations,
                layerCount: animationCount.layers
            });
        } else {
            DEBUG.error("Export failed", result.error);
            return JSON.stringify({
                success: false,
                error: result.error,
                details: result.details
            });
        }

    } catch (error) {
        DEBUG.error("Export failed with exception", error);
        return JSON.stringify({success: false, error: error.toString()});
    }
}

// Extract motion spec building into separate function for clarity
function buildMotionSpecData(comp, selectedLayers) {
    var multiplier = detectCompositionMultiplier(comp);
    var workAreaStart = comp.workAreaStart;
    var workAreaDuration = comp.workAreaDuration;

    // Work area duration in AE is frame-inclusive (includes the last frame's full duration)
    // For motion specs, we want the duration from first frame START to last frame START
    // So subtract one frame's worth of time
    var frameTime = 1 / comp.frameRate;
    var adjustedDuration = workAreaDuration - frameTime;

    var motionSpec = {
        compName: comp.name,
        workArea: {
            start: Math.round(workAreaStart * 1000),
            duration: Math.round(adjustedDuration * 1000)
        },
        layers: [],
        metadata: {
            version: MOTION_SPEC_CONFIG.VERSION,
            timestamp: new Date().toString(),
            exportedBy: "Figma Motion Spec Exporter HTTP",
            composition: {
                width: comp.width,
                height: comp.height,
                frameRate: comp.frameRate,
                appliedScale: multiplier + "x",
                scaleMode: MOTION_SPEC_CONFIG.SCALE_OVERRIDE > 0 ? "manual" : "auto",
                scaleSettingIndex: MOTION_SPEC_CONFIG.SCALE_OVERRIDE
            }
        }
    };

    // Track which layers have been added as parented children to avoid duplicates
    var processedAsChild = {};

    // Process each selected layer with enhanced error handling
    for (var i = 0; i < selectedLayers.length; i++) {
        var layer = selectedLayers[i];

        // Skip if this layer was already added as a parented child of another layer
        if (processedAsChild[layer.index]) {
            DEBUG.log("Skipping layer " + layer.name + " - already processed as parented child");
            continue;
        }

        try {
            var isGuide = layer.isGuideLayer ? " (GUIDE)" : "";
            DEBUG.log("Processing layer " + (i + 1) + "/" + selectedLayers.length + ": " + layer.name + isGuide);

            var layerData = {
                layerName: sanitizeLayerName(layer.name),
                animations: [],
                layerType: getLayerType(layer)
            };

            // Check for Fit to Shape effect
            var fitToShapeData = detectFitToShapeEffect(layer);
            if (fitToShapeData) {
                DEBUG.log("Layer has Fit to Shape effect - will suppress normal parenting spec");
                layerData.isFitToShape = true;
            }

            var selectedProperties = findPropertiesWithSelectedKeyframes(layer);
            DEBUG.log("Found " + selectedProperties.length + " properties with selected keyframes on " + layer.name);

            for (var propIndex = 0; propIndex < selectedProperties.length; propIndex++) {
                var propInfo = selectedProperties[propIndex];

                try {
                    DEBUG.log("Processing property: " + propInfo.name + " (" + propInfo.selectedKeys + " selected keys)");

                    // Extract animation data for this property
                    var animationData = extractAnimationData(layer, propInfo, comp, multiplier);
                    if (animationData) {
                        // If this layer has Fit to Shape, attach it to the first animation
                        if (fitToShapeData && layerData.animations.length === 0) {
                            animationData.fitToShape = fitToShapeData;
                            animationData.isFitToShape = true;
                        }
                        layerData.animations.push(animationData);
                        DEBUG.log("Successfully processed " + propInfo.name);
                    } else {
                        DEBUG.log("No animation data returned for " + propInfo.name);
                    }
                } catch (propError) {
                    DEBUG.error("Error processing property " + propInfo.name + " on layer " + layer.name, propError);
                    // Continue processing other properties even if one fails
                }
            }

            // If layer has Fit to Shape but NO animations, create a placeholder animation entry
            if (fitToShapeData && layerData.animations.length === 0) {
                DEBUG.log("Creating placeholder animation for Fit to Shape layer with no animated properties");
                layerData.animations.push({
                    property: "Fit to Shape",
                    fitToShape: fitToShapeData,
                    isFitToShape: true,
                    hasKeyframes: false,
                    easing: { type: "linear", source: null },
                    timing: { delay: 0, duration: 0 },
                    values: null,
                    movement: null
                });
            }

            // Check if this layer is parented and has an animating ancestor (grandparent inheritance)
            // This handles cases where a layer is parented to a non-animating layer, which is parented to an animating layer
            // Note: Include parenting data even for Fit to Shape layers (it's in the JSON, Figma can choose to display or not)
            if (layer.parent) {
                var ancestorInfo = findAnimatingAncestor(layer);
                if (ancestorInfo) {
                    layerData.parenting = {
                        parentName: sanitizeLayerName(ancestorInfo.ancestorName),
                        animatingProperties: ancestorInfo.animatingProperties
                    };
                    // If not a direct parent, note the intermediate layer(s)
                    if (!ancestorInfo.isDirectParent && ancestorInfo.parentChain.length > 1) {
                        layerData.parenting.via = sanitizeLayerName(layer.parent.name);
                    }
                    DEBUG.log("Added ancestor parenting info to " + layer.name + ": inherits from " + ancestorInfo.ancestorName);
                }
            }

            // For Fit to Shape layers, add parenting based on the container layer (even if no transform animations)
            // The Fit to Shape effect inherits size/position from its container, which may animate Width/Height
            if (fitToShapeData && fitToShapeData.containerLayerName && !layerData.parenting) {
                // Find the container layer and check what's animating on it
                var containerAnimProps = [];
                try {
                    for (var cl = 1; cl <= comp.numLayers; cl++) {
                        var checkLayer = comp.layer(cl);
                        if (checkLayer.name === fitToShapeData.containerLayerName ||
                            sanitizeLayerName(checkLayer.name) === fitToShapeData.containerLayerName) {
                            // Check for any animating properties on this container
                            var propsToCheck = findPropertiesWithSelectedKeyframes(checkLayer);
                            for (var pc = 0; pc < propsToCheck.length; pc++) {
                                containerAnimProps.push(propsToCheck[pc].name.toLowerCase());
                            }
                            // Also check transform properties even if not selected
                            if (checkLayer.transform.scale && checkLayer.transform.scale.numKeys > 0) {
                                if (containerAnimProps.indexOf("scale") === -1) containerAnimProps.push("scale");
                            }
                            break;
                        }
                    }
                } catch (containerError) {
                    DEBUG.log("Error checking container properties: " + containerError);
                }

                if (containerAnimProps.length > 0) {
                    layerData.parenting = {
                        parentName: fitToShapeData.containerLayerName,
                        animatingProperties: containerAnimProps,
                        isFitToShapeContainer: true
                    };
                    DEBUG.log("Added Fit to Shape container parenting to " + layer.name + ": container " + fitToShapeData.containerLayerName + " animates " + containerAnimProps.join(", "));
                }
            }

            // Add layer if it has animations OR has Fit to Shape effect
            if (layerData.animations.length > 0 || layerData.isFitToShape) {
                // Hide layers that are parented and have "Mask" in their name (technical/matte layers)
                var shouldHideLayer = false;
                if (layer.parent && layer.name.toLowerCase().indexOf("mask") !== -1) {
                    shouldHideLayer = true;
                    DEBUG.log("Hiding mask layer: " + layer.name + " (parented and contains 'Mask')");
                }

                if (!shouldHideLayer) {
                    motionSpec.layers.push(layerData);
                    DEBUG.log("Added layer " + layer.name + " with " + layerData.animations.length + " animations" + (layerData.isFitToShape ? " (Fit to Shape)" : ""));
                }

                // Check if this layer has any children parented to it (for normal parenting)
                // Pass selectedLayers so we only include children that are also selected
                var childLayers = findChildLayers(layer, comp, selectedLayers);

                if (childLayers.length > 0) {
                    DEBUG.log("Found " + childLayers.length + " child layers parented to " + layer.name);

                    // Add a layer entry for each child showing inheritance AND its own animations
                    for (var childIndex = 0; childIndex < childLayers.length; childIndex++) {
                        var child = childLayers[childIndex];

                        // Extract child's own animations (selected keyframes)
                        var childAnimations = [];
                        try {
                            var childSelectedProps = findPropertiesWithSelectedKeyframes(child.layer);
                            DEBUG.log("Child " + child.layerName + " has " + childSelectedProps.length + " selected properties");

                            for (var cp = 0; cp < childSelectedProps.length; cp++) {
                                var childAnimData = extractAnimationData(child.layer, childSelectedProps[cp], comp, multiplier);
                                if (childAnimData) {
                                    childAnimations.push(childAnimData);
                                }
                            }
                        } catch (childAnimError) {
                            DEBUG.error("Error extracting child animations for " + child.layerName, childAnimError);
                        }

                        var childLayerData = {
                            layerName: child.layerName,
                            animations: childAnimations,
                            layerType: "parented",
                            parenting: {
                                parentName: child.parentName,
                                animatingProperties: child.inheritedProperties
                            }
                        };
                        motionSpec.layers.push(childLayerData);

                        // Mark this child as processed so it won't be added again in the main loop
                        processedAsChild[child.layer.index] = true;

                        DEBUG.log("Added parented child: " + child.layerName + " with " + childAnimations.length + " own animations");
                    }
                }
            } else {
                DEBUG.log("No animations found on layer " + layer.name);
            }

        } catch (layerError) {
            DEBUG.error("Error processing layer " + layer.name, layerError);
            // Continue processing other layers even if one fails
        }
    }

    // Check for selected layers that are parented but have no keyframes
    // These are child layers selected independently
    DEBUG.log("Checking for selected parented layers without keyframes...");
    for (var i = 0; i < selectedLayers.length; i++) {
        var layer = selectedLayers[i];

        // Skip if already processed as a parented child
        if (processedAsChild[layer.index]) {
            continue;
        }

        // Check if this layer is parented and wasn't already added to the spec
        if (layer.parent) {
            var alreadyAdded = false;
            for (var k = 0; k < motionSpec.layers.length; k++) {
                if (motionSpec.layers[k].layerName === sanitizeLayerName(layer.name)) {
                    alreadyAdded = true;
                    break;
                }
            }

            if (!alreadyAdded) {
                DEBUG.log("Found selected parented layer without keyframes: " + layer.name);

                // Check which properties are animating on the parent
                var parentAnimatingProperties = [];
                var parent = layer.parent;

                try {
                    var parentTransformProps = [
                        { prop: parent.transform.position, name: "position" },
                        { prop: parent.transform.rotation, name: "rotation" },
                        { prop: parent.transform.scale, name: "scale" }
                    ];

                    for (var p = 0; p < parentTransformProps.length; p++) {
                        var propCheck = parentTransformProps[p];
                        try {
                            if (propCheck.prop && propCheck.prop.canVaryOverTime && propCheck.prop.numKeys > 0) {
                                parentAnimatingProperties.push(propCheck.name);
                            }
                        } catch (propError) {}
                    }

                    // Note: Opacity is NOT inherited via AE parenting - only transforms

                    if (parentAnimatingProperties.length > 0) {
                        // Extract child's own animations (selected keyframes)
                        var childOwnAnimations = [];
                        try {
                            var childSelectedProps = findPropertiesWithSelectedKeyframes(layer);
                            for (var cp = 0; cp < childSelectedProps.length; cp++) {
                                var childAnimData = extractAnimationData(layer, childSelectedProps[cp], comp, multiplier);
                                if (childAnimData) {
                                    childOwnAnimations.push(childAnimData);
                                }
                            }
                        } catch (childAnimError) {
                            DEBUG.log("Error extracting child animations: " + childAnimError);
                        }

                        var childLayerData = {
                            layerName: sanitizeLayerName(layer.name),
                            animations: childOwnAnimations,
                            layerType: "parented",
                            parenting: {
                                parentName: sanitizeLayerName(parent.name),
                                animatingProperties: parentAnimatingProperties
                            }
                        };
                        motionSpec.layers.push(childLayerData);
                        DEBUG.log("Added independently selected parented child: " + layer.name + " with " + childOwnAnimations.length + " own animations");
                    }
                } catch (parentError) {
                    DEBUG.log("Error checking parent properties: " + parentError);
                }
            }
        }
    }

    // Note: We only export selected layers - no automatic inclusion of unselected Fit to Shape children
    // This keeps exports predictable and consistent with user selection

    return motionSpec;
}

// Updated UI with batch preview and connection status
function createMotionSpecPanel() {
    var panel = new Window("palette", "Motion Spec → Figma v" + MOTION_SPEC_CONFIG.VERSION);
    panel.orientation = "column";
    panel.alignChildren = "fill";
    panel.spacing = 10;
    panel.margins = 15;

    // Animation preview group
    var previewGroup = panel.add("group");
    previewGroup.orientation = "column";
    previewGroup.alignChildren = "fill";

    // Header with refresh button
    var headerGroup = previewGroup.add("group");
    headerGroup.orientation = "row";
    headerGroup.alignChildren = "center";

    var previewTitle = headerGroup.add("statictext", undefined, "Selected Animations:");
    var refreshButton = headerGroup.add("button", undefined, "Refresh");
    refreshButton.preferredSize.width = 80;

    var previewText = previewGroup.add("statictext", undefined, "Select keyframes, then click Refresh...");
    previewText.preferredSize.height = 60;

    // Scale override group
    var scaleGroup = panel.add("group");
    scaleGroup.orientation = "row";
    scaleGroup.alignChildren = "center";

    scaleGroup.add("statictext", undefined, "Scale:");
    var scaleDropdown = scaleGroup.add("dropdownlist", undefined, ["Auto-detect", "1x", "2x", "3x", "4x"]);
    scaleDropdown.selection = 0; // Default to auto-detect
    scaleDropdown.preferredSize.width = 110;

    // Buttons group
    var buttonGroup = panel.add("group");
    buttonGroup.orientation = "column";
    buttonGroup.alignChildren = "fill";

    var sendButton = buttonGroup.add("button", undefined, "Send to Figma");
    sendButton.preferredSize.height = 35;

    var clipboardButton = buttonGroup.add("button", undefined, "Copy to Clipboard");
    clipboardButton.preferredSize.height = 30;

    var debugCheckbox = buttonGroup.add("checkbox", undefined, "Debug Mode");
    debugCheckbox.value = MOTION_SPEC_CONFIG.DEBUG_MODE;

    // No connection status needed - we just write files!

    // Update animation preview
    function updateAnimationPreview() {
        var count = countSelectedAnimations();
        if (count.animations === 0) {
            previewText.text = "Select keyframes across layers and properties...";
            sendButton.enabled = false;
        } else {
            var preview = count.animations + " animations from " + count.layers + " layers:\\n";
            for (var i = 0; i < count.details.length && i < 3; i++) {
                var layer = count.details[i];
                preview += "• " + layer.name + ": " + layer.properties.join(", ") + "\\n";
            }
            if (count.details.length > 3) {
                preview += "... and " + (count.details.length - 3) + " more layers";
            }
            previewText.text = preview;
            sendButton.enabled = true;
        }
    }

    // Event handlers
    refreshButton.onClick = function() {
        updateAnimationPreview();
        DEBUG.log("UI refreshed - animation preview updated");
    };

    sendButton.onClick = function() {
        exportMotionSpecToFigma();
        // Refresh preview after export
        setTimeout(function() { updateAnimationPreview(); }, 100);
    };

    debugCheckbox.onClick = function() {
        MOTION_SPEC_CONFIG.DEBUG_MODE = this.value;
    };

    scaleDropdown.onChange = function() {
        // Dropdown indices: 0 = Auto-detect, 1 = 1x, 2 = 2x, 3 = 3x, 4 = 4x
        // SCALE_OVERRIDE = 0 triggers auto-detection, 1-4 forces that scale factor
        MOTION_SPEC_CONFIG.SCALE_OVERRIDE = this.selection.index;
        DEBUG.log("Scale override changed to: " + (this.selection.index === 0 ? "Auto-detect" : this.selection.index + "x"));
    };

    clipboardButton.onClick = function() {
        copyMotionSpecToClipboard();
    };

    // Panel events
    panel.onShow = function() {
        updateAnimationPreview();
    };

    // Initial status update
    updateAnimationPreview();

    return panel;
}

// Show the panel
function showMotionSpecPanel() {
    var panel = createMotionSpecPanel();
    panel.show();
}

// Main entry point
function main() {
    try {
        showMotionSpecPanel();
    } catch (e) {
        alert("Script execution failed: " + e.toString());
    }
}

// Execute
try {
    main();
} catch (e) {
    $.writeln("Execution error: " + e.toString());
    alert("Script execution failed: " + e.toString());
}

/*
TODO: Copy all the motion spec extraction functions from the original script:
- detectCompositionMultiplier()
- findPropertiesWithSelectedKeyframes()
- extractPropertyValues()
- parseAllSpringsFromMarker()
- findSpringForProperty()
- detectBakedSpring()
- extractCubicBezierFromSelectedKeyframes()
- extractAnimationData()
- roundMs()
- formatJSON()
- etc.

For brevity in this example, I've focused on the new HTTP communication parts.
The full implementation would include all existing extraction functions.
*/