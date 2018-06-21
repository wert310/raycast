/**
 * loadImage: preload image from url
 * @param str (String) image url
 * @return new Image object                               
 */
var loadImage = function (str) {
  var a = new Image();
  a.src = str;
  return a;
}

/**
 * appState: App mutable state object 
 */
var appState = { ctx: document.getElementById("canvas").getContext('2d')
               // screen
               , width: 320
               , height: 240
               // map
               , blocksize: 64
               , textures: [ document.getElementById("bluestone") //loadImage("wolf_bluestone.png")
                           , document.getElementById("greystone") //loadImage("wolf_greystone.png")
                           , document.getElementById("wood") ] //loadImage("wolf_wood.png") ]
               , imageDataTextures: undefined
               , map: [ [1,1,1,1,1,1,1,1,1,1,1,1,1]
                      , [1,1,0,0,0,1,0,0,0,0,0,0,1]
                      , [1,0,0,0,0,1,0,0,0,0,0,0,1]
                      , [1,0,0,0,0,1,0,0,0,0,0,0,1]
                      , [1,0,0,0,0,0,0,0,0,0,0,0,1]
                      , [1,1,1,1,1,1,0,0,0,0,0,0,1]
                      , [2,0,0,0,0,0,3,3,3,3,0,0,1]
                      , [2,0,0,0,0,0,0,0,0,0,0,0,1]
                      , [2,2,2,2,2,2,2,2,2,2,2,2,2] ]
               , spritesImages: [ loadImage("wolf_barrel.png") 
                                , loadImage("wolf_lamp.png") ]
               , sprites: [ { img: 0, x: 2.5, y: 1.5 } 
                          , { img: 0, x: 6.5, y: 1.5 }
                          , { img: 0, x: 7.5, y: 1.5 }
                          , { img: 1, x: 3.5, y: 8.5 }
                          , { img: 1, x: 6.5, y: 3.5 } ]
               // player
               , posX: 4
               , posY: 3
               , dirX: -1
               , dirY: 0
               , planeX: 0
               , planeY: 0.66 
               , FOV: undefined
               // buffers (floorcast)
               , stripeFloor: undefined
               , stripeCieling: undefined };

/**
 * initState: initialize state fields
 * @param appState state to initialize
 * @return modified appState 
 */
var initState = function(appState) {
  // buffers
  appState.stripeFloor = appState.ctx.createImageData(1,appState.height);
  appState.stripeCieling = appState.ctx.createImageData(1, appState.height);
  
  // imageData textures generation
  /* var xorImageData = appState.ctx.createImageData(appState.blocksize, appState.blocksize);
  var gradImageData = appState.ctx.createImageData(appState.blocksize, appState.blocksize);
  generateSimpleTexture(xorImageData, function (x,y) { 
    var c = x^y; 
    return { r:c, g:c, b:c, a:0xff } 
  });
  generateSimpleTexture(gradImageData, function (x,y) {
    var c = x+y;
    return {r:c*0.5, g:c, b:c, a:0xff }
  });
  appState.imageDataTextures = [ xorImageData, gradImageData ]; */
  
  // get appState.textures imagedata
  appState.imageDataTextures = appState.textures.map(function (t) {
    appState.ctx.drawImage(t,0,0);
    return appState.ctx.getImageData(0,0,64,64);
  });
  
  // FOV calc (2*tan(length plane / length dir)) (randians)
  appState.FOV = 2 * Math.atan
      ( Math.sqrt(Math.pow(appState.planeX,2)+Math.pow(appState.planeY,2)) 
      / Math.sqrt(Math.pow(appState.dirX,2)+Math.pow(appState.dirY,2)));
  
  // disable antialising (walls & sprites)
  appState.ctx.imageSmoothingEnabled = false;
  
  return appState;
}

/**
 * generateSimpleTexture: draw simple texture (fn x y) on imageData
 * @param imageData output image imageData
 * @param fn ( x,y -> { r, g, b, a} ) color function
 * @return void (IO)
 */
var generateSimpleTexture = function (imageData, fn) {
  for (var y=0; y<imageData.height; y++)
    for (var x=0; x<imageData.width; x++){
      var c = fn(x,y);
      var idx = (x+y*imageData.height)*4;
      imageData.data[idx+0] = c.r;
      imageData.data[idx+1] = c.g;
      imageData.data[idx+2] = c.b;
      imageData.data[idx+3] = c.a;
    }
}

/**
 * raycast: cast ray from x position
 * @param appState application state
 * @param x (int) (0 < x < appState.width)
 * @return (Object [ distance(float)  -- ditance from the first wall
 *                 , side(int)        -- wall side (0 -> x, 1 -> y)
 *                 , mapVal (int)     -- map value (ray intersection)
 *                 , wallX (float) )] -- wall intersection position
 */
var raycast = function (appState, x){
  var cameraX = (2*x / appState.width)-1;
  var rayPosX = appState.posX, 
      rayPosY = appState.posY;
  var rayDirX = appState.dirX + appState.planeX * cameraX, 
      rayDirY = appState.dirY + appState.planeY * cameraX;
  var mapX = Math.trunc(rayPosX), 
      mapY = Math.trunc(rayPosY);
  var deltaDistX = Math.sqrt(1 + Math.pow(rayDirY,2)/Math.pow(rayDirX,2)),
      deltaDistY = Math.sqrt(1 + Math.pow(rayDirX,2)/Math.pow(rayDirY,2));
  var sideDistX = deltaDistX * ((rayDirX < 0) ? rayPosX - mapX 
                                             : (mapX+1) - rayPosX),
      sideDistY = deltaDistY * ((rayDirY < 0) ? rayPosY - mapY
                                             : (mapY+1) - rayPosY);
  var stepX = (rayDirX < 0) ? -1 : 1;
  var stepY = (rayDirY < 0) ? -1 : 1;
  var side = null;
  for (var hit = false; !hit; hit = (appState.map[mapX][mapY] > 0)){
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapX += stepX;
      side = 0;
    }else{
      sideDistY += deltaDistY;
      mapY += stepY;
      side = 1;
    }
  } //point found
  var distance = Math.abs ((side == 0) ? (mapX - rayPosX + (1-stepX)/2) / rayDirX 
                                       : (mapY - rayPosY + (1-stepY)/2) / rayDirY);
  var intersection = (side==0) ? rayPosY+rayDirY*distance : rayPosX+rayDirX*distance;
  var relativeX = intersection - Math.floor(intersection);
  var wallX = ((side == 0 && rayDirX > 0) || (side == 1 && rayDirY < 0)) ? 1-relativeX : relativeX;
  return { distance: distance
         , side: side
         , mapVal: appState.map[mapX][mapY]
         , wallX: wallX };
}

/**
 * rotateView: rotates the camera plane by applying a vector transformation 
 * to appState.dir and appState.plane
 * appState object is changed
 * @param appState application state
 * @param angle (float) rotation angle
 * @return modified appState
 */
var rotateView = function (appState, angle) {
  var dirX_ = appState.dirX, planeX_ = appState.planeX;
  appState.dirX = appState.dirX * Math.cos(angle) - appState.dirY * Math.sin(angle);
  appState.dirY = dirX_ * Math.sin(angle) + appState.dirY * Math.cos(angle);
  appState.planeX = appState.planeX * Math.cos(angle) - appState.planeY * Math.sin(angle);
  appState.planeY = planeX_ * Math.sin(angle) + appState.planeY * Math.cos(angle);
  return appState;
}

/**
 * drawShadowSlice: shadows slice given light intensity
 * @param appState application state
 * @param x (int) x screen coordinate
 * @param height (int) wall height on screen
 * @param light (float) light intensity
 * @return void (IO)
 */
var drawShadowSlice = function (appState, x, height, light) {
  appState.ctx.save();
  appState.ctx.globalAlpha = 1-light;
  drawSlice(appState, height, x, "#000");
  appState.ctx.restore();
}

/**
 * drawSlice: draws untextured wall slice on the screen
 * @param appState application state
 * @param height (int) wall height on screen
 * @param x (int) x coordinate on screen
 * @param color (String) wall color
 * @param light (float) &optional color intensity (wall light)
 * @return void (IO) (mutates appState.ctx)
 */
var drawSlice = function (appState, height, x, color, light) {
  appState.ctx.fillStyle = color;
  appState.ctx.fillRect(x, (appState.height/2)-(height/2), 1, height);
  if (light) drawShadowSlice(appState, x, height, light);
}

/**
 * drawTexturedSlice: draws textured wall slice on the screen
 * @param appState application state
 * @param height (int) wall height on screen
 * @param x (int) x position on screen
 * @param teNum (int) texture index (appState.textures)
 * @param tex (int) x position on the texture
 * @param light (float) &optional color intensity (wall light)
 * @return void (IO) (mutates appState.ctx)
 */
var drawTexturedSlice = function (appState, height, x, teNum, tex, light) {
  appState.ctx.drawImage(appState.textures[teNum], 
                         tex*(appState.blocksize-1), 0, 1, appState.blocksize,
                         x, (appState.height/2)-(height/2), 1, height);
  if (light) drawShadowSlice(appState, x, height, light);
}

/**
 * lightDist: light from distance
 * @param distance (float)
 * @return (float) light value
 */
var lightDist = function (distance) {
  return Math.min(1, 2*(1/(distance+1)));
}

/**
 * floorcast: draws the floor
 * @param appState application state
 * @param x (int) x screen position
 * @param startY (int) starting y position
 * @param floorImageData floor imageData texture
 * @param cielingImageData cieling imageData texture
 * @return void (IO)
 */
var floorcast = function (appState, x, startY, floorImageData, cielingImageData) {
  var cameraX = (2*x / appState.width)-1;
  var rayDirX = appState.dirX + (appState.planeX*cameraX);
  var rayDirY = appState.dirY + (appState.planeY*cameraX);
  var dist,distX,distY,absposX,absposY,relposX,relposY;
  var idx;
  var light;
  if (appState.height-startY > 0) {
    for (var y = startY; y < appState.height; y++) {
      dist = appState.height / (2*y - appState.height);
      distX = dist*rayDirX;
      distY = dist*rayDirY;
      absposX = appState.posX + distX;
      absposY = appState.posY + distY;
      relposX = Math.trunc(absposX*appState.blocksize)%appState.blocksize;
      relposY = Math.trunc(absposY*appState.blocksize)%appState.blocksize;
      light = lightDist(dist);
      idx = (relposX+relposY*floorImageData.width)*4;
      appState.stripeFloor.data[(y-startY)*4+0] = floorImageData.data[idx+0]*light;
      appState.stripeFloor.data[(y-startY)*4+1] = floorImageData.data[idx+1]*light;
      appState.stripeFloor.data[(y-startY)*4+2] = floorImageData.data[idx+2]*light;
      appState.stripeFloor.data[(y-startY)*4+3] = floorImageData.data[idx+3];
      appState.stripeCieling.data[(appState.height-y-1)*4+0] = cielingImageData.data[idx+0]*light;
      appState.stripeCieling.data[(appState.height-y-1)*4+1] = cielingImageData.data[idx+1]*light;
      appState.stripeCieling.data[(appState.height-y-1)*4+2] = cielingImageData.data[idx+2]*light;
      appState.stripeCieling.data[(appState.height-y-1)*4+3] = cielingImageData.data[idx+3];
    }
    appState.ctx.putImageData(appState.stripeFloor, x, startY, 0, 0, 1, (appState.height-startY));
    appState.ctx.putImageData(appState.stripeCieling, x, 
                              (appState.height-startY)-Math.abs(appState.height-startY), 0, 0,
                              1, (appState.height-startY));
  }
}

/**
 * spritecast: draws the sprites on camera plane
 * @param appState application state
 * @param distArray distance array (for every x)
 * @return void (IO)
 */
var spritecast = function (appState, distArray) {
  appState.sprites
  .map(function (a) {
    return { dist: Math.sqrt(Math.pow(a.x - appState.posX, 2) + Math.pow(a.y - appState.posY, 2))
           , sprite: a };
  })
  .sort(function (a, b) { return a.dist < b.dist})
  .forEach(function (s) {
    var relX = s.sprite.x - appState.posX;
    var relY = s.sprite.y - appState.posY;
    var angle = Math.atan2(relY,relX) - Math.atan2(appState.dirY,appState.dirX);
    if (angle < -Math.PI) angle += 2*Math.PI; //punto di discontinuità atan2
    if (angle >= Math.PI) angle -= 2*Math.PI;
    if (Math.abs(angle) <= appState.FOV) {
      var size = appState.height / (s.dist*Math.cos(angle)); //fisheye corection
      var centerX = Math.tan(angle) * appState.height;// <- ?? Math.PI*(Math.sin(angle/2)*appState.width/2);
      var screenX = appState.width/2 - centerX - size/2; 
      for (var x = 0; x<size; x++){
        var cx = screenX + x;
        var cy = (appState.height/2)-(size/2);
        var imgX = x * appState.blocksize / size;
        if ((s.dist*Math.cos(angle)) < distArray[Math.round(cx)])
            appState.ctx.drawImage(appState.spritesImages[s.sprite.img], imgX, 0,
                               1, appState.blocksize, cx, cy, 1, size);
      }
    }
  });
}

/**
 * renderScreen: render the screen from appState
 * @param appState application state
 * @return void (IO)
 */
var renderScreen = function (appState) {
  var distArray = []
  for (var x=0; x < appState.width; x++){
    var robj = raycast(appState, x);
    var height = appState.height / robj.distance;
    // drawSlice(appState, height, x, (robj.side == 0)?"#2060BB":"#2257aa", lightDist(robj.distance));
    drawTexturedSlice(appState, height, x, robj.mapVal-1, robj.wallX, lightDist(robj.distance)); 
    floorcast(appState, x, Math.floor(appState.height/2 + height/2), 
              appState.imageDataTextures[1], appState.imageDataTextures[2]);
    distArray[x] = robj.distance;
  }
  spritecast(appState, distArray);
}

/**
 * getTimeDelta: closure-based time delta counter
 * @param time (int) actual time
 * @return (int) time delta
 */
var getTimeDelta = (function (oldTime) {
  return function (time) {
    var diff = time - oldTime;
    oldTime = time;
    return diff;
  };
})(0);

/**
 * drawMinimap: draws the current map in sx sy with specified tilesize
 * @param appState application state
 * @param sx start x
 * @param sy start y
 * @param tilesize map tile size
 * @return void (IO)
 */
var drawMinimap = function (appState, sx, sy, tilesize){ //TODO: coordinate?!?!?
  for (var x = 0; x<appState.map[0].length; x++)
    for (var y = 0; y<appState.map.length; y++){
      appState.ctx.fillStyle = (appState.map[y][x] > 0)? "#000" : "#fff";
      appState.ctx.fillRect(sx+x*tilesize, sy+y*tilesize, tilesize, tilesize);
    }
  appState.ctx.fillStyle = "#912121";
  appState.ctx.fillRect(sx+appState.posY*tilesize-tilesize/4, 
                        sy+appState.posX*tilesize-tilesize/4, tilesize/2, tilesize/2);
}

/**
 * main: main function (pressed_keys from html)
 * @param appState application state
 * @return void (IO)
 */
var main = function (appState) {
  var drawBackground = function () {
    appState.ctx.save();
    appState.ctx.fillStyle = "#414141";
    appState.ctx.fillRect(0,0, appState.width, appState.height/2);
    appState.ctx.fillStyle = "#212121";
    appState.ctx.fillRect(0, appState.height/2, appState.width, appState.height);
    appState.ctx.restore();
  };
  var drawFPS = function (timeDelta) {
    appState.ctx.fillStyle = "#000";
    appState.ctx.fillRect(0,0,63,13);
    appState.ctx.fillStyle = "#fff";
    appState.ctx.font = "10px Sans"
    appState.ctx.fillText("FPS: "+(1/timeDelta).toFixed(3), 1,10);   
  };
  var draw = function (timeDelta) {
    drawBackground();
    renderScreen(appState);
    drawFPS(timeDelta);
    drawMinimap(appState, 0, appState.height-4*appState.map.length, 4)
  };
  var walkable = function (x, y) {
    return 0 >= appState.map[Math.trunc(x)][Math.trunc(y)];
  };
  var updateCoords = function (bs) { //updates appState
    var newx = appState.posX + appState.dirX * bs, 
        newy = appState.posY + appState.dirY * bs;
    if (walkable(newx,appState.posY)) appState.posX = newx;
    if (walkable(appState.posX,newy)) appState.posY = newy;
  };
  var update = function (timeDelta) {
      if (pressed_keys.left) rotateView(appState, 1*timeDelta);
      if (pressed_keys.right) rotateView(appState, -1*timeDelta);
      if (pressed_keys.up) updateCoords(1*timeDelta);
      if (pressed_keys.down) updateCoords(-1*timeDelta);
  };
  var frame = function (time) {
    var timeDelta = getTimeDelta(time) / 1000;
    requestAnimationFrame(frame);
    update(timeDelta);
    draw(timeDelta);
  };
  requestAnimationFrame(frame);
}

// main entryPoint
main(initState(appState));
