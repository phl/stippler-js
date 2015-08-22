Stippler = function(imgData, canvas) {

    // TODO: pull out all the magic numbers
    // TODO: manhattan distance gives artifacts
    
    var REPEL_CONST = 1/4096; // ??? fuckin' magnets

    var EMITTER_SPEED = 0.15;
    var EMIT_INTERVAL = 30;
    var SPLIT_CHANCE = 0.006;//0.006;
    var SPLIT_MINAGE = 60;

    var P_SIZE = 8.0;     // 8 , 12
    var CELL_SIZE = 16.0;  // 16

    var BG_FILL = "#303";
    var FG_FILL = "#fff";

    var tickNum = 0;
    this.ctx = canvas.getContext("2d");

    this.start = function() {
      this.clear();
      this.model = new Model();

      for (var i = 0;i<8;i++) {
//        this.model.addPoint(Math.random()*canvas.width,Math.random()*canvas.height);
        this.model.split(new Emitter(canvas.width*0.5,canvas.height*0.5));
      } 

      this.run();
    }

    this.run = function() {
      this.tick();
      this.draw();
      // if (tickNum % 2 == 0) saveimg(canvas,tickNum/2);
      var that = this;
      setTimeout(function(){that.run()},1000/60); // yeah right
    }

    this.tick = function() {
      this.model.calc();
      this.model.tick();
      this.tickNum++;
    }

    this.draw = function() {
      this.clear();
      this.model.draw(this.ctx);
    }

    this.clear = function() {
      this.ctx.fillStyle = BG_FILL; 
      this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    }


    //-------------------------------------------
    // Point

    var Point = (function() {
      function Point(x, y) {
        this.pos = new Vec2(x,y);
        this.vel = new Vec2(0,0);
        this.force = new Vec2(0,0);
        this.size = 1.0;
      }
      Point.prototype = {
        calc : function() {
          this.vel.mult(0.8); // damping, TODO f=ma?
          this.vel.vadd(this.force);
          this.vel.limit(1.0);
        },
        tick : function() {
          this.pos.vadd(this.vel);
          if (!inBounds(this.pos.x, this.pos.y)) {
            return;
          }
          var pxl = this.pixel();
          var bright = (pxl[0]*0.3 + pxl[1]*0.59 + pxl[2]*0.11) / 255;
          var targetSize = P_SIZE * bright;
          this.size += (targetSize - this.size)/8; // TODO or constant growth?
          this.force.clear();
        },
        draw : function(ctx) {
          var radius = this.size * this.size * 0.3 / P_SIZE;
          //if (radius < 0.1) return;

          ctx.fillStyle = FG_FILL; 
          ctx.beginPath();
          ctx.arc(this.pos.x, this.pos.y, radius, 0, 2*Math.PI, true);
          ctx.fill();
        },
        pixel : function() {
          var x = Math.floor(imgData.width * this.pos.x / canvas.width);
          var y = Math.floor(imgData.height * this.pos.y / canvas.height);

          // TODO: look into Uint32 stuff
          var pxl = ((y * imgData.width) + x) * 4;
          return [
                  imgData.data[pxl],
                  imgData.data[pxl+1],
                  imgData.data[pxl+2]
                  ];
        }
      }
      return Point;
    }());



    //-------------------------------------------
    // Emitter

    var Emitter = (function() {
      function Emitter(x,y,a) {
        if (arguments.length < 3) a = Math.random()*2*Math.PI;
        this.angle = a; 
        this.pos = new Vec2(x,y);
        this.vel = new Vec2(Math.sin(a)*EMITTER_SPEED, Math.cos(a)*EMITTER_SPEED);
        this.age = 0;
        this.emitNow = false;
        this.splitNow = false;
      }
      Emitter.prototype = {
        tick : function() {
          this.age++;
          this.pos.vadd(this.vel);
          this.emitNow = (this.age % EMIT_INTERVAL == 0);
          this.splitNow = (this.age > SPLIT_MINAGE && chance(SPLIT_CHANCE));
        },
        split : function() {
          return [
            new Emitter(this.pos.x,this.pos.y,this.angle+Math.random()*Math.PI/2),
            new Emitter(this.pos.x,this.pos.y,this.angle+Math.random()*Math.PI/2)
          ];
        }
      }
      return Emitter;
    }());



    //-------------------------------------------
    // Cell

    var Cell = (function() {
      function Cell(x, y) {
        this.origin = new Vec2(x,y);
        this.neighbours = [];
        this.points = [];
        this.migrants = [];
      }
      Cell.prototype = {
        addNeighbour : function(cell) {
          this.neighbours.push(cell);
        },
        addPoint : function(p) {
          this.points.push(p);
        },
        removePoint : function(p) {
           var idx = this.points.indexOf(p);
           if (idx > -1) this.points.splice(idx,1);
        },
        calc : function() {
          for (var i=0, n=this.points.length; i<n; i++) {
            var p = this.points[i];

            for (var j=0, m=this.neighbours.length; j<m; j++) {
              p.force.vadd(this.neighbours[j].forces(p));
            }
            p.force.vadd(this.forces(p));

            p.force.limit(1);
            p.calc();
          }
        },
        tick : function() {
          this.migrants = [];
          for (var i=0, n=this.points.length; i<n; i++) {
            var p = this.points[i];
            p.tick();
            var px = p.pos.x;
            var py = p.pos.y;
            if (px < this.origin.x || px >= this.origin.x + CELL_SIZE ||
                py < this.origin.y || py >= this.origin.y + CELL_SIZE) {

              this.migrants.push(p);
            }
          }
        },
        draw : function(ctx) {
          for (var i=0, n=this.points.length; i<n; i++) {
            this.points[i].draw(ctx);
          }
        },
        forces : function(p) {
          var forces = new Vec2(0,0);
          for (var i=0, n=this.points.length; i<n; i++) {
            var p1 = this.points[i];
            if (p1 !== p) {
              var v = Vec2.sub(p.pos, p1.pos);
              var dist = v.man(); // hey, manhattan
              if (dist <= CELL_SIZE) {
                //v.div(dist); // normalize
                //dist /= CELL_SIZE;
                //v.mult(REPEL_CONST * p.size * p1.size / (dist * dist));

                v.mult(REPEL_CONST * p.size * p1.size * CELL_SIZE * CELL_SIZE / (dist*dist*dist));

                forces.vadd(v);
              }
            }
          }
          return forces;
        }
      }
      return Cell;
    }());



    //-------------------------------------------
    // Model

    var Model = (function() {
      function Model() {
        this.dimCells = new Vec2(Math.ceil(canvas.width/CELL_SIZE),
                                  Math.ceil(canvas.height/CELL_SIZE));
        this.cells = [];
        this.emitters = [];

        for (var x=0; x < this.dimCells.x; x++) {
          this.cells[x] = [];
          for (var y=0; y < this.dimCells.y; y++) {
            this.cells[x][y] = new Cell(x * CELL_SIZE, y * CELL_SIZE);
          }
        }

        this.eachCell(function(cell,x,y) {
          var c = this.cells;
          var leftEdge = x==0;
          var topEdge = y==0;
          var rightEdge = x==this.dimCells.x-1;
          var bottomEdge = y==this.dimCells.y-1;

          if (!topEdge) {
            if (!leftEdge) cell.addNeighbour(c[x-1][y-1]);
            cell.addNeighbour(c[x][y-1]);
            if (!rightEdge) cell.addNeighbour(c[x+1][y-1]);
          }

          if (!leftEdge) cell.addNeighbour(c[x-1][y]);
          if (!rightEdge) cell.addNeighbour(c[x+1][y]);

          if (!bottomEdge) {
            if (!leftEdge) cell.addNeighbour(c[x-1][y+1]);
            cell.addNeighbour(c[x][y+1]);
            if (!rightEdge) cell.addNeighbour(c[x+1][y+1]);
          }
        });
      }
      Model.prototype = {
        eachCell : function(f) {
          for (var x=0, nx=this.dimCells.x; x < nx ; x++) {
            for (var y=0, ny=this.dimCells.y; y < ny; y++) {
              f.call(this, this.cells[x][y], x, y);
            }
          }
        },
        addPoint : function(x,y) {
          if (!inBounds(x,y)) return;
          var p = new Point(x, y);
          this.cells[Math.floor(x/CELL_SIZE)][Math.floor(y/CELL_SIZE)].addPoint(p);
        },
        split : function(e) {
          var idx = this.emitters.indexOf(e); // TODO slow
          if (idx > -1) this.emitters.splice(idx,1);
          // TODO bounds check
          var splittees = e.split();
          this.emitters.push(splittees[0]);
          this.emitters.push(splittees[1]);
        },
        calc : function() {
          this.eachCell(function(cell,x,y) {
            cell.calc();
          });
        },
        tick : function() {
          var migrants = [];
          this.eachCell(function(cell,x,y) {
            cell.tick();
            for (var i=0, n=cell.migrants.length; i<n; i++) {
              var p = cell.migrants[i];
              cell.removePoint(p);
              migrants.push(p);
            }
          });

          for (var i=0, n=migrants.length; i<n; i++) {
            var p = migrants[i];
            var x = p.pos.x;
            var y = p.pos.y;
            if (inBounds(x,y)) {
              this.cells[Math.floor(x/CELL_SIZE)][Math.floor(y/CELL_SIZE)].addPoint(p);
            }
          }

          var splitters = [];
          for (var i=0, n=this.emitters.length; i<n; i++) {
            var e = this.emitters[i];
            e.tick();
            if (e.emitNow) this.addPoint(e.pos.x,e.pos.y);
            if (e.splitNow) splitters.push(e);
          }
          for (var i=0, n=splitters.length; i<n; i++) {
            this.split(splitters[i]);
          }
        },

        draw : function(ctx) {
          this.eachCell(function(cell,x,y) {
            cell.draw(ctx);
          });
        },
      }
      return Model;
    }());



    //-------------------------------------------
    // Vector

    var Vec2 = (function() {
      function Vec2(x, y) {
        this.x = x || 0;
        this.y = y || 0;
      }

      Vec2.prototype = {
        get : function() {
          return new Vec2(this.x, this.y);
        },
        add: function(x, y) {
            this.x += x;
            this.y += y;
        },
        vadd: function(v) {
            this.x += v.x;
            this.y += v.y;
        },
        sub: function(x, y) {
            this.x -= x;
            this.y -= y;
        },
        vsub: function(v) {
            this.x -= v.x;
            this.y -= v.y;
        },
        mult: function(n) {
            this.x *= n;
            this.y *= n;
        },
        vmult: function(v) {
            this.x *= v.x;
            this.y *= v.y;
        },
        div: function(n) {
            this.x /= n;
            this.y /= n;
        },
        vdiv: function(v) {
            this.x /= v.x;
            this.y /= v.y;
        },
        dist : function(v) {
          var dx = this.x - v.x,
              dy = this.y - v.y;
          return Math.sqrt(dx * dx + dy * dy);
        },
        mag : function() {
          var x = this.x;
          var y = this.y;
          return Math.sqrt(x * x + y * y);
        },
        man : function(v) {
          var x = this.x < 0 ? -this.x : this.x;
          var y = this.y < 0 ? -this.y : this.y;
          return 0.79351 * (x + y);
        },
        normalize : function() {
          var m = this.mag();
          if (m > 0) {
            this.div(m);
          }
        },
        limit : function(high) {
          var magsq = this.x*this.x + this.y*this.y;
          if (magsq > high*high) { 
              this.mult(high/Math.sqrt(magsq));
          }
        },
        clear : function() {
          this.x = this.y = 0;
        }
      };

      Vec2.add = function(v1, v2) {
        var v = v1.get();
        v.vadd(v2);
        return v;
      }
      Vec2.sub = function(v1, v2) {
        var v = v1.get();
        v.vsub(v2);
        return v;
      }
      Vec2.mult = function(v1, v2) {
        var v = v1.get();
        v.vmult(v2);
        return v;
      }
      Vec2.div = function(v1, v2) {
        var v = v1.get();
        v.vdiv(v2);
        return v;
      }
      Vec2.dist = function(v1, v2) {
        return v1.dist(v2);
      };

      return Vec2;
    }());


    //-------------------------------------------
    // Utils

    function chance(prob) {
      return prob > Math.random();
    }

    function inBounds(x,y) {
      return x>=1 && x<canvas.width && y>=0 && y<canvas.height;
    }

    function saveimg(canvas, framenum) {
      var outputImg = document.createElement("img");
      outputImg.src = canvas.toDataURL();

      var downloader = document.getElementById('downloader');
      if (!downloader) {
        downloader = document.createElement('div');
        downloader.id = 'downloader';
        downloader.style.display = 'none';
      }
      document.body.appendChild(downloader);

      while (downloader.children.length > 0) {
        downloader.removeChild(downloader.children[downloader.children.length - 1]);
      }

      var anchor = document.createElement('a');
      anchor.href = outputImg.src;
      anchor.target = "_blank";

      var paddedNum = "0000"+framenum;
      paddedNum = paddedNum.substring(paddedNum.length-5,paddedNum.length);
      anchor.download = "frame-"+paddednum+".png";
      downloader.appendChild(anchor);
      anchor.click();
      document.body.removeChild(downloader);
    }
}
