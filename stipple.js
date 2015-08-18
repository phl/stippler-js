Stipple = function(imgData, canvas) {

    var CELL_SIZE = 10.0;
    var width = canvas.width;
    var height = canvas.height;
    var ctx = canvas.getContext("2d");

    var particles ;//= new ParticleSystem();

    this.start = function() {
      particles = new ParticleSystem();
      this.tick();
    }

    this.draw = function() {
      ctx.fillStyle = "#fff"; // TODO: gray, coloured particles
      ctx.globalAlpha = 1;
      ctx.fillRect(0, 0, width, height);

      particles.draw();
    }

    this.tick = function() {

      particles.add(width/2 + (-2 + Math.random()*4),
                    height/2 + (-2 + Math.random()*4));
      particles.add(width/2 + (-2 + Math.random()*4),
                    height/2 + (-2 + Math.random()*4));

      particles.plan();
      particles.move();

      this.draw();
      var foo = this;
      setTimeout(function(){foo.tick()},1);
    }



    //-------------------------------------------
    // Particle

    var Particle = (function() {

      function Particle(x, y) {
        this.origin = new Vec2(x,y);
        this.mass = 1.0;
        this.velocity = new Vec2(0,0);
      }

      Particle.prototype = {
        plan : function(force) {
          this.velocity.mult(0.9); // damping
          force.div(this.mass); // f = ma
          this.velocity.add(force);
        },
        move : function() {
          this.origin.add(this.velocity);
          if (this.outOfBounds()) {
            return;
          }
          var x = Math.floor(map(this.origin.x, 0, width, 0, imgData.width));
          var y = Math.floor(map(this.origin.y, 0, height, 0, imgData.height));
          // TODO: look into Uint32 stuff
          var pxl = ((y * imgData.width) + x) * 4;
          var r = imgData.data[pxl];
          var g = imgData.data[pxl+1];
          var b = imgData.data[pxl+2];
          var targetMass = CELL_SIZE * norm(Math.max(r,g,b), 256, 0);
          if (targetMass > this.mass) {
            this.mass = Math.min(this.mass * 1.1, targetMass);
          } else {
            this.mass = Math.max(this.mass * 0.9, targetMass);
          }
        },
        outOfBounds : function() {
          if (this.origin.x < 0 || this.origin.x >= width) {
            return true;
          }
          if (this.origin.y < 0 || this.origin.y >= height) {
            return true;
          }
          return false;
        },
        draw : function() {
          ctx.fillStyle = "#404040"; // TODO: take color from image?
          var n = norm(this.mass, 0, CELL_SIZE);
          var r = CELL_SIZE;// * n * n;
          ctx.beginPath();
          ctx.ellipse(this.origin.x, this.origin.y, r, r, 0, 0, 2 * Math.PI);
          ctx.fill();
        }
      };

      return Particle;
    })();
    


    //-------------------------------------------
    // Cell
    
    var Cell = (function() {
        function Cell(sys, x, y) {
          this.sys = sys;
          this.neighbours = [];
          this.particles = [];
          this.origin = new Vec2(CELL_SIZE * x, CELL_SIZE * y);
        }

        Cell.prototype = {
          plan : function() {
            for (var i=0; i<this.particles.length; i++) {
              var p = this.particles[i];
              var force = this.repel(p);
              for (var j=0; j<this.neighbours.length; j++) {
                var cell = this.neighbours[j];
                if (cell) {
                  force.add(cell.repel(p));
                }
              }
              force.limit(1.0);
              p.plan(force);
            }
          },
          move : function() {
            for (var i=this.particles.length - 1; i>=0; i--) {
              var p = this.particles[i];
              p.move();
              if (!this.contains(p.origin.x, p.origin.y)) {
                this.remove(p);
                this.sys.place(p);
              }
            }
          },
          draw : function() {
            for (var i=0 ; i<this.particles.length; i++) {
              this.particles[i].draw();
            }
            //this.debugDraw();
          },
          add : function(p) {
            this.particles.push(p);
          },
          remove : function(p) {
            var idx = this.particles.indexOf(p);
            if (idx > -1) this.particles.splice(idx,1);
          },
          repel : function(p) {
            var sum = new Vec2(0,0);
            for (var i=0; i<this.particles.length; i++) {
              var other = this.particles[i];
              if (other === p) {
                continue; // don't repel self
              }
              var dist = Vec2.dist(p.origin, other.origin);
              if (dist > CELL_SIZE) {
                continue;
              }
              var unit = Vec2.sub(p.origin, other.origin);
              unit.normalize();
              dist = norm(dist, 0, CELL_SIZE);
              unit.mult((p.mass * other.mass) / (dist * dist));
              sum.add(unit);
            }
            return sum;
          },
          contains : function(x, y) {
            var dx = x - this.origin.x;
            if (dx < 0 || dx > CELL_SIZE) {
              return false;
            }
            var dy = y - this.origin.y;
            if (dy < 0 || dy > CELL_SIZE) {
              return false;
            }
            return true;
          }
        };

        return Cell;
    }());

    //-------------------------------------------
    // Particle system

    var ParticleSystem = (function() {

      function ParticleSystem() {
        this.cellWidth = Math.floor(width / CELL_SIZE);
        this.cellHeight = Math.floor(height / CELL_SIZE);
        this.cells = [];

        for (var x=0; x < this.cellWidth; x++) {
          this.cells[x] = [];
          for (var y=0; y < this.cellHeight; y++) {
            this.cells[x][y] = new Cell(this, x, y);
          }
        }
        for (var x=0; x < this.cellWidth; x++) {
          for (var y=0; y < this.cellHeight; y++) {
            this.cells[x][y].neighbours = this.neighbours(x, y);
          }
        }
      }

      ParticleSystem.prototype = {
        plan : function() {
          for (var x=0; x < this.cellWidth; x++) {
            for (var y=0; y < this.cellHeight; y++) {
              this.cells[x][y].plan();
            }
          }
        },
        move : function() {
          for (var x=0; x < this.cellWidth; x++) {
            for (var y=0; y < this.cellHeight; y++) {
              this.cells[x][y].move();
            }
          }
        },
        draw : function() {
          for (var x=0; x < this.cellWidth; x++) {
            for (var y=0; y < this.cellHeight; y++) {
              this.cells[x][y].draw();
            }
          }
        },
        add : function(x, y) {
          var p = new Particle(x, y);
          this.place(p);
        },
        place : function(p) {
          var cellx = Math.floor(p.origin.x / CELL_SIZE);
          var celly = Math.floor(p.origin.y / CELL_SIZE);
          if (cellx < 0 || cellx >= this.cellWidth) {
            return;
          }
          if (celly < 0 || celly >= this.cellHeight) {
            return;
          }
          var cell = this.cells[cellx][celly];
          cell.add(p);
        },
        neighbours : function(x, y) {
          return [
            this.getCell(x-1, y-1),
            this.getCell(x  , y-1),
            this.getCell(x+1, y-1),
            this.getCell(x-1, y  ),
            this.getCell(x+1, y  ),
            this.getCell(x-1, y+1),
            this.getCell(x  , y+1),
            this.getCell(x+1, y+1)
          ];
        },
        getCell : function(x, y) {
          if (x<0 || x>=this.cellWidth || y<0 || y>=this.cellHeight) {
            return null;
          }
          return this.cells[x][y];
        }
      };

      return ParticleSystem;
    }());

    //-------------------------------------------
    // Vector (ripped from processing-js)

    var Vec2 = (function() {
      function Vec2(x, y) {
        this.x = x || 0;
        this.y = y || 0;
      }

      Vec2.dist = function(v1, v2) {
        return v1.dist(v2);
      };

      Vec2.prototype = {
        get : function() {
          return new Vec2(this.x, this.y);
        },
        add: function(v, y) {
          if (arguments.length === 1) {
            this.x += v.x;
            this.y += v.y;
          } else {
            this.x += v;
            this.y += y;
          }
        },
        sub: function(v, y) {
          if (arguments.length === 1) {
            this.x -= v.x;
            this.y -= v.y;
          } else {
            this.x -= v;
            this.y -= y;
          }
        },
        mult: function(v) {
          if (typeof v === 'number') {
            this.x *= v;
            this.y *= v;
          } else {
            this.x *= v.x;
            this.y *= v.y;
          }
        },
        div: function(v) {
          if (typeof v === 'number') {
            this.x /= v;
            this.y /= v;
          } else {
            this.x /= v.x;
            this.y /= v.y;
          }
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
        normalize : function() {
          var m = this.mag();
          if (m > 0) {
            this.div(m);
          }
        },
        limit: function(high) {
          if (this.mag() > high) {
            this.normalize();
            this.mult(high);
          }
        },
      };

      for (var method in Vec2.prototype) {
        if (Vec2.prototype.hasOwnProperty(method) && !Vec2.hasOwnProperty(method)) {
          Vec2[method] = function(v1, v2) {
            var v = v1.get();
            v[method](v2);
            return v;
          };
        }
      }

      return Vec2;
    }());


    //-------------------------------------------
    // Processing utils

    function norm(val, low, high) {
      return (val - low) / (high - low);
    }

    function map(val, istart, iend, ostart, oend) {
      return ostart + (oend - ostart) * ((val - istart) / (iend - istart));
    }
}
