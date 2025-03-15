// Draws contour blocks to the canvas with coordinate transformations
function drawContours() {
    let isFirstIteration = true;
    let prevX, prevY, tPrevX, tPrevY, tX, tY;
    let prevView = null;
    let currentView = null;
    let arcLine = 0;
    let arcData = [];
    let fX, fY, sX, sY, eX, eY, r;
    let arcType = '';

    for (dataLine of contourData) {
        currentView = dataLine[0];

        // Skip drawing the line if the face has changed
        if (prevView !== null && prevView !== currentView) {
            prevX = dataLine[1];
            prevY = dataLine[3];
            prevView = currentView;
            continue;
        }
        prevView = currentView;

        // Skip drawing the first line from origin
        if (isFirstIteration) {
            prevX = dataLine[1];
            prevY = dataLine[3];
            isFirstIteration = false;
            continue;
        }

        let view = currentView + '-view';
        let layer = layers[view];
        let stage = layers[view].getStage(); // Get the Konva Stage
        let canvasWidth = stage.width();
        let canvasHeight = stage.height();

        //Check if the line is an arc and stores it in arcData
        if(dataLine[4] != 0 && arcLine == 0) {
            fX = dataLine[1];
            fY = dataLine[3];
            arcLine++;
            arcData.push(fX, fY);
        }
        else if(arcLine == 1) {
            sX = dataLine[1];
            sY = dataLine[3];
            r = dataLine[4];
            arcLine++;
            arcData.push(sX, sY, r);
            continue; 
        }
        else  if(dataLine[4] == 0 && arcLine == 2) {
            eX = dataLine[1];
            eY = dataLine[3];
            arcLine = 0;
            arcType = 'partial';
            arcData.push(eX, eY);
            continue; 
        }
        else if(dataLine[4] != 0 && arcLine == 2) {
            arcLine++;
            continue;
        }
        else if(dataLine[4] == 0 && arcLine == 3){
            eX = dataLine[1];
            eY = dataLine[3];
            arcLine = 0;
            arcType = 'full';
            arcData.push(eX, eY);
            continue;
        }

        if (arcData.length !== 0 && arcType === 'partial') {
            //Get center point correctly
            let cX = arcData[0] === arcData[2] ? arcData[5] : arcData[0];
            let cY = arcData[1] === arcData[3] ? arcData[6] : arcData[1];
            let sX = arcData[0];
            let sY = arcData[1];
            [cX, cY] = transformCoordinates(view, cX, cY, canvasWidth, canvasHeight);
            [sX, sY] = transformCoordinates(view, sX, sY, canvasWidth, canvasHeight);
            const isClockwise = arcData[4] > 0 ? true : false;
            const r = Math.abs(arcData[4]);
        
            //Compute start and end angles in degrees
            let startAngle = Math.atan2(sY - cY, sX - cX) * (180 / Math.PI);
        
            let arc = new Konva.Arc({
                x: cX,
                y: cY,
                innerRadius: r,
                outerRadius: r,
                angle: 90,
                stroke: 'black',
                rotation: startAngle, 
                strokeWidth: 3,
                name: 'contour-arc',
                clockwise: isClockwise,
            });
        
            arc.strokeScaleEnabled(false); //Prevent stroke scaling when zooming
            layer.add(arc);
            layer.batchDraw();

            prevX = arcData[5];
            prevY = arcData[6];
        
            arcData = [];
            arcType = '';
        }

        if (arcData.length !== 0 && arcType === 'full') {
            //Get center point correctly
            let cX = arcData[2];
            let cY = arcData[3];
            let sX = arcData[0];
            let sY = arcData[1];
            let eX = arcData[5];
            let eY = arcData[6];
            [cX, cY] = transformCoordinates(view, cX, cY, canvasWidth, canvasHeight);
            [sX, sY] = transformCoordinates(view, sX, sY, canvasWidth, canvasHeight);
            [eX, eY] = transformCoordinates(view, eX, eY, canvasWidth, canvasHeight);
            const isClockwise = arcData[4] > 0 ? true : false;
            const r = Math.abs(arcData[4]);
        
            //Compute start and end angles in degrees
            let startAngle = Math.atan2(sY - cY, sX - cX) * (180 / Math.PI);
            let endAngle = Math.atan2(eY - cY, eX - cX) * (180 / Math.PI);
            startAngle = (startAngle + 360) % 360;
            endAngle = (endAngle + 360) % 360;
            let sweepAngle;
            if (isClockwise) {
                sweepAngle = endAngle - startAngle;
                if (sweepAngle < 0) sweepAngle += 360; //Ensure positive sweep
            } else {
                sweepAngle = startAngle - endAngle;
                if (sweepAngle < 0) sweepAngle += 360; //Ensure positive sweep
                sweepAngle += 180; //Ensure correct sweep angle
            }
        
            let arc = new Konva.Arc({
                x: cX,
                y: cY,
                innerRadius: r,
                outerRadius: r,
                angle: sweepAngle,
                stroke: 'black',
                rotation: startAngle, 
                strokeWidth: 3,
                name: 'contour-arc',
                clockwise: isClockwise,
            });
        
            arc.strokeScaleEnabled(false); //Prevent stroke scaling when zooming
            layer.add(arc);
            layer.batchDraw();

            prevX = arcData[5];
            prevY = arcData[6];
        
            arcData = [];
            arcType = '';
        }
        
        
        //Apply transformations based on the view
        [tPrevX, tPrevY] = transformCoordinates(view, prevX, prevY, canvasWidth, canvasHeight);
        [tX, tY] = transformCoordinates(view, dataLine[1], dataLine[3], canvasWidth, canvasHeight);

        let line = new Konva.Line({
            points: [tPrevX, tPrevY, tX, tY],
            stroke: 'black',
            strokeWidth: 3,
            name: 'contour-line',
            snapPoints: [
                { x: tPrevX, y: tPrevY }, // Start
                { x: (tPrevX + tX) / 2, y: (tPrevY + tY) / 2 }, // Middle
                { x: tX, y: tY }  // End
            ]
        });

        //create snap indicator
        addSnapIndicator(tPrevX, tPrevY, view);
        addSnapIndicator((tPrevX + tX) / 2, (tPrevY + tY) / 2, view);
        addSnapIndicator(tX, tY, view);

        prevX = dataLine[1];
        prevY = dataLine[3];

        line.strokeScaleEnabled(false); //Prevent stroke scaling when zooming
        layer.add(line);
        layer.batchDraw();
    }
}

// Draws contour blocks to the canvas with coordinate transformations
function drawHoles() {
    let currentView = null;

    for (const [index, dataLine] of holeData.entries()) {
        currentView = dataLine[0];
        let holeType = dataLine[4];
        let view = currentView + '-view';
        let layer = layers[view];
        let stage = layers[view].getStage(); // Get the Konva Stage
        let canvasWidth = stage.width();
        let canvasHeight = stage.height();
        let hole;
        let tX, tY;
        let d = dataLine[5];
        let r = d / 2;

        //draws a slot if present in dataline
        if (dataLine[7][0] == 'l') {
            // Calculate the slot dimensions
            let slotWidth = dataLine[8] + d;
            let slotHeight = dataLine[9] + d;

            //Apply transformations based on the view for rectangle
            [tX, tY] = transformCoordinates(view, dataLine[1], dataLine[3], canvasWidth, canvasHeight);
            // Create a rounded rectangle (slot)
            let slot = new Konva.Rect({
                x: tX,
                y: tY,
                width: slotWidth,
                height: slotHeight,
                cornerRadius: d / 2, // Rounded corners
                stroke: 'black',
                strokeWidth: 3,
                rotation: -dataLine[10], // Rotate the slot
                offsetX: r,
                offsetY: slotHeight - r,
                name: `circle-${index}`, 
                snapPoints : [
                    {tX, tY}
                ]
            });

            //create snap indicator
            addSnapIndicator(tX, tY, view);

            // Add the slot to the layer and redraw
            slot.strokeScaleEnabled(false);
            layer.add(slot);
            layer.batchDraw();

            continue;
        }

        [tX, tY] = transformCoordinates(view, dataLine[1], dataLine[3], canvasWidth, canvasHeight);
        if (holeType == 'm') {
            hole = new Konva.Circle({
                x: tX,  // X position
                y: tY,  // Y position
                radius: 2,  // Small radius to appear as a dot
                fill: 'black',  // Fill color
                strokeWidth: 1,  // Stroke thickness\
                name: `circle-${index}`,
                snapPoints: [
                    { x: tX, y: tY }, // Center
                ]
            });
            //create snap indicator
            addSnapIndicator(tX, tY, view);
        }
        else
        {
            hole = new Konva.Circle({
                x: tX, 
                y: tY,
                radius: r,
                stroke: 'black',
                strokeWidth: 3,
                name: `circle-${index}`,
                snapPoints: [
                    { x: tX, y: tY }, // Center
                    { x: tX + r, y: tY }, // Right (0°)
                    { x: tX, y: tY - r }, // Top (90°)
                    { x: tX - r, y: tY }, // Left (180°)
                    { x: tX, y: tY + r }, // Bottom (270°)
                ]
            });
            //create snap indicator
            addSnapIndicator(tX, tY, view);
            addSnapIndicator(tX + r, tY, view);
            addSnapIndicator(tX, tY - r, view);
            addSnapIndicator(tX - r, tY, view);
            addSnapIndicator(tX, tY + r, view);
        }

        hole.strokeScaleEnabled(false);
        layer.add(hole);
        layer.batchDraw();
    }
}

//Changes the color of a hole in view
function changeHoleColor(holeDiv) {
    //Reset all hole colors to black
    for (const dataLine of holeData) {
        let layer = layers[dataLine[0] + '-view'];
        let holes = layer.find(node => node instanceof Konva.Circle);
        holes.forEach(hole => {hole.stroke('black')});
        let Rectangles = layer.find(node => node instanceof Konva.Rect);
        Rectangles.forEach(hole => {hole.stroke('black')});
    }
    document.querySelectorAll('.holeCard').forEach(card => {card.classList.remove('selected-file');}); //Removes green selection boarder from all hole card elements

    let index = holeDiv.dataset.index;
    let view = holeDiv.dataset.view;
    let layer = layers[view];
    let hole = layer.findOne(`.circle-${index}`); // Find the hole by its name
    holeDiv.classList.add('selected-file');
    hole.stroke('green');
    layer.batchDraw();
}

//Draws marks to the canvas
function drawMarks() {
    let currentView = null;
    let prevX, prevY;
    
    for (dataLine of marksData) {
        currentView = dataLine[0];
        let view = currentView + '-view';
        let layer = layers[view];
        let stage = layers[view].getStage(); // Get the Konva Stage
        let canvasWidth = stage.width();
        let canvasHeight = stage.height();
        let tX, tY, tPrevX, tPrevY;
        let r = dataLine[4];
        let isStart = dataLine[5];

        if (r == 0) {
            if (isStart) {
                prevX = dataLine[1];
                prevY = dataLine[3];
                continue;
            }
            // Apply transformations based on the view
            [tPrevX, tPrevY] = transformCoordinates(view, prevX, prevY, canvasWidth, canvasHeight);
            [tX, tY] = transformCoordinates(view, dataLine[1], dataLine[3], canvasWidth, canvasHeight);
            let mark = new Konva.Line({
                points: [tPrevX, tPrevY, tX, tY],
                stroke: 'black',
                strokeWidth: 3,
                name: 'mark-line',
                snapPoints: [
                    { x: tPrevX, y: tPrevY }, // Start
                    { x: (tPrevX + tX) / 2, y: (tPrevY + tY) / 2 }, // Middle
                    { x: tX, y: tY }  // End
                ]
            });
            //create snap indicator
            addSnapIndicator(tPrevX, tPrevY, view);
            addSnapIndicator((tPrevX + tX) / 2, (tPrevY + tY) / 2, view);
            addSnapIndicator(tX, tY, view);

            prevX = dataLine[1];
            prevY = dataLine[3];
    
            mark.strokeScaleEnabled(false); //Prevent stroke scaling when zooming
            layer.add(mark);
            continue;
        }
        
        let mark = new Konva.Circle({
            x: tX,  // X position
            y: tY,  // Y position
            radius: r,  
            fill: 'black',  // Fill color
            strokeWidth: 1,  // Stroke thickness\
            snapPoints: [
                { x: tX, y: tY }, // Center
            ]
        });
        //create snap indicator
        addSnapIndicator(tX, tY, view);
        mark.strokeScaleEnabled(false);
        layer.add(mark);
        layer.batchDraw();
    }
}

//Draws numerations to the canvas
function drawNumertaions() {
    let currentView = null;

    for (dataLine of numerationsData) {
        currentView = dataLine[0];
        let view = currentView + '-view';
        let layer = layers[view];
        let stage = layers[view].getStage(); // Get the Konva Stage
        let canvasWidth = stage.width();
        let canvasHeight = stage.height();
        let tX, tY;
        let angle = dataLine[4];
        let height = dataLine[5];
        let text = dataLine[7];
    
        [tX, tY] = transformCoordinates(view, dataLine[1], dataLine[3], canvasWidth, canvasHeight);
    
        const numeration = new Konva.Text({
            x: tX,
            y: tY,
            text: text,
            fontSize: height, // Set text height as font size
            fontFamily: 'Arial',
            fill: 'black',
            rotation: angle // Rotate text by given angle
        });
    
        numeration.strokeScaleEnabled(false);
        layer.add(numeration);
        layer.batchDraw();
    }
}

//Function to apply coordinate transformations based on view
function transformCoordinates(view, x, y, width, height) {
    switch (view) {
        case 'v-view': // Bottom-right, X and Y negative
            return [ x, height - y];
        case 'u-view': // Bottom-left, X negative only
            return [x, height - y];
        case 'h-view': // Top-right, Y negative only
            return [x, y];
        case 'o-view': // Bottom-right, X and Y negative
            return [width - x, height - y];
        default:
            return [x, y]; // No transformation for unknown views
    }
}

//Function to apply angle transformations based on view
function transformAngle(view, angle) {
    switch (view) {
        case 'v-view': // Bottom-right, X and Y negative
            return (360 - angle) % 360;
        case 'u-view': // Bottom-left, X negative only
            return (360 - angle) % 360;
        case 'h-view': // Top-right, Y negative only
            return angle;
        case 'o-view': // Bottom-right, X and Y negative
            return (180 + angle) % 360;
        default:
            return angle; // No transformation for unknown views
    }
}

//Draws blocs to the canves
function drawBlocs(){
    clearAllViews();
    drawContours();
    drawHoles();
    drawMarks();
    drawNumertaions();
}

//Shows or hide views
function switchView(view, btn) {
    btn.classList.toggle('lighten-3'); //Switches the button color to display state
    btn.dataset.tooltip == 'ON' ? btn.dataset.tooltip = 'OFF' : btn.dataset.tooltip = 'ON'; //Switches the tooltip text
    M.Tooltip.getInstance(btn).close(); //Closes the tooltip
    document.getElementById(view + 'ViewTitle').classList.toggle('hide'); //Toggles the view title visibility
    document.getElementById(view + '-view').classList.toggle('hide'); //Toggles the view visibility
    views.forEach(view => handleResize(view)); //Resizes the views for the new container size
}

//Create a snap indicator point in a view at x, y
function addSnapIndicator(x, y, view) {
    let snapLayer = snapLayers[view]; // Use snap layer for the active view

    let indicator = new Konva.Circle({
        x: x,
        y: y,
        radius: 2, // Small snap indicator
        fill: 'red',
        strokeWidth: 1,
        name: 'snap-indicator',
        listening: false // Make sure it does not interfere with clicks
    });

    indicator.strokeScaleEnabled(false);
    snapLayer.add(indicator);
    snapLayer.batchDraw();
}