Stipple = function(imgData, canvas) {

    // TODO: pull out magic numbers
    
    var MAG_CONST = 1; //0.00005;
    var EMIT_RATE = 30;
    var SPAWN_CHANCE = 0.006;//0.006;
    var SPAWN_TICKS = 60;
    var P_SIZE = 8.0;     // 8 , 12
    var CELL_SIZE = 8.0;  // 16
    var width = canvas.width;
    var height = canvas.height;
    var ctx = canvas.getContext("2d");
    var particles;

    this.start = function() {
      particles = new ParticleSystem();
      for (var i = 0;i<4;i++) {
        //particles.add(Math.random()*width,Math.random()*height);
        particles.spawn(new Emitter(width*0.5,height*0.5));
      }
      this.tick();
    }

    this.draw = function(ctx) {
      ctx.fillStyle = "#000"; 
      ctx.globalAlpha = 1;
      ctx.fillRect(0, 0, width, height);

      particles.draw(ctx);
    }

    this.tick = function() {

      particles.calc();
      particles.move();
      particles.emit();
      this.draw(ctx);
      var that = this;
      setTimeout(function(){that.tick()},1);
    }



    //-------------------------------------------
    // Particle

    var Particle = (function() {

      function Particle(x, y) {
        this.pos = new Vec2(x,y);
        this.velocity = new Vec2(0,0);
        this.mass = 1.0;
        this.moved = false;
      }

      Particle.prototype = {
        calc : function(force) {
          this.velocity.mult(0.8); // damping
          //force.div(this.mass); // f = ma
          this.velocity.addv(force);
          this.velocity.limit(1.0);
          this.moved = false;
        },
        move : function() {
          if (this.moved) return;

          this.moved = true;
          this.pos.addv(this.velocity);
          if (!this.withinBounds()) {
            return;
          }
          var x = Math.floor(map(this.pos.x, 0, width, 0, imgData.width));
          var y = Math.floor(map(this.pos.y, 0, height, 0, imgData.height));
          // TODO: look into Uint32 stuff
          var pxl = ((y * imgData.width) + x) * 4;
          var r = imgData.data[pxl];
          var g = imgData.data[pxl+1];
          var b = imgData.data[pxl+2];
          var brightness = r*0.3 + g*0.59 + b*0.11;
          var targetMass = P_SIZE * norm(brightness, 0, 256, 0);
          if (targetMass > this.mass) {
            this.mass = Math.min(this.mass * 1.1, targetMass);
          } else {
            this.mass = Math.max(this.mass * 0.9, targetMass);
          }
        },
        withinBounds : function() {
          return this.pos.x >= 0 && this.pos.x < width && 
            this.pos.y >= 0 && this.pos.y < height;
        },
        draw : function(ctx) {
          var n = norm(this.mass, 0, P_SIZE);
          var r = P_SIZE * n * n * 0.3;

          ctx.fillStyle = "#fff"; 
          // TODO join tiny particles with dark lines, yo
          ctx.save();
          ctx.translate(this.pos.x, this.pos.y);
          ctx.scale(r,r);
          ctx.beginPath();
          ctx.arc(0, 0, 1, 0, 2*Math.PI, true);
          ctx.fill();
          ctx.restore();
        },
      };

      return Particle;
    })();

    var Emitter = (function() {

      function Emitter(x, y, a) {
        if (!a) a = Math.random()*2*Math.PI;
        this.pos = new Vec2(x,y);
        this.angle = a;
        var velX = 0.15*Math.sin(a);
        var velY = 0.15*Math.cos(a);
        this.velocity = new Vec2(velX,velY);
        this.ticks = 0;
      }

      Emitter.prototype = {
          move : function() {
              this.pos.addv(this.velocity);
          },
          emit : function() {
              if (this.ticks++ % EMIT_RATE == 0) {
                  return new Particle(this.pos.x, this.pos.y);
              }
          },
          draw : function (ctx) {
            ctx.save();
            ctx.strokeStyle = "#f00";
            ctx.translate(this.pos.x, this.pos.y);
            ctx.moveTo(-1,-1);
            ctx.lineTo(1,1);
            ctx.moveTo(1,-1);
            ctx.lineTo(-1,1);
            ctx.stroke(); 
            ctx.restore();
          },
          spawn : function() {
            return this.ticks > SPAWN_TICKS && chance(SPAWN_CHANCE);
          }
      };

      return Emitter;
    }());
    


    //-------------------------------------------
    // Cell
    
    var Cell = (function() {
        function Cell(sys, x, y) {
          this.sys = sys;
          this.neighbours = [];
          this.particles = [];
          this.pos = new Vec2(CELL_SIZE * x, CELL_SIZE * y);
        }

        Cell.prototype = {
          calc : function() {
            for (var i=0, n=this.particles.length; i<n; i++) {
              var p = this.particles[i];
              var force = this.repel(p);
              for (var j=0, m=this.neighbours.length; j<m; j++) {
                var cell = this.neighbours[j];
                if (cell) {
                  force.addv(cell.repel(p));
                }
              }
              force.limit(1);
              p.calc(force);
            }
          },
          move : function() {
            for (var i=this.particles.length - 1; i>=0; i--) {
              var p = this.particles[i];
              p.move();
              if (!this.contains(p.pos.x, p.pos.y)) {
                this.remove(p);
                this.sys.place(p);
              }
            }
          },
          draw : function(ctx) {
            for (var i=0, n=this.particles.length; i<n; i++) {
              this.particles[i].draw(ctx);
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
            for (var i=0, n=this.particles.length; i<n; i++) {
              var other = this.particles[i];
              if (other === p) {
                continue; // don't repel self
              }
              var vec = Vec2.sub(p.pos, other.pos);
              var dist = vec.mag();
              if (dist > CELL_SIZE) {
                  continue;
              }
              vec.div(dist); // normalize
              dist /= CELL_SIZE; // normalize
              vec.mult(MAG_CONST * (p.mass * other.mass) / (dist * dist));
              sum.addv(vec);
            }
            return sum;
          },
          contains : function(x, y) {
            var dx = x - this.pos.x;
            if (dx < 0 || dx >= CELL_SIZE) {
              return false;
            }
            var dy = y - this.pos.y;
            if (dy < 0 || dy >= CELL_SIZE) {
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
        this.emitters = [];
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
        calc : function() {
          for (var x=0; x < this.cellWidth; x++) {
            for (var y=0; y < this.cellHeight; y++) {
              this.cells[x][y].calc();
            }
          }
        },
        move : function() {
          for (var x=0; x < this.cellWidth; x++) {
            for (var y=0; y < this.cellHeight; y++) {
              this.cells[x][y].move();
            }
          }
          for (var i=0, n=this.emitters.length; i<n; i++) {
            this.emitters[i].move();
          }
        },
        draw : function(ctx) {
          for (var x=0; x < this.cellWidth; x++) {
            for (var y=0; y < this.cellHeight; y++) {
              this.cells[x][y].draw(ctx);
            }
          }
          return;
          for (var i=0, n=this.emitters.length; i<n; i++) {
            this.emitters[i].draw(ctx);
          }
        },
        emit : function() {
          var spawners = [];
          for (var i=0, n=this.emitters.length; i<n; i++) {
            var e = this.emitters[i];
            var p = e.emit();
            if (p) this.place(p);
            if (e.spawn()) spawners.push(e);
          }
          for (var i=0, n=spawners.length; i<n; i++) {
            this.spawn(spawners[i]);
          }
        },
        add : function(x, y) {
          var p = new Particle(x, y);
          this.place(p);
        },
        spawn : function(e) {
          var idx = this.emitters.indexOf(e);
          if (idx > -1) this.emitters.splice(idx,1);
          this.emitters.push(new Emitter(e.pos.x,e.pos.y,e.angle+Math.random()*Math.PI/2));
          this.emitters.push(new Emitter(e.pos.x,e.pos.y,e.angle-Math.random()*Math.PI/2));
        },
        place : function(p) {
          var x = Math.floor(p.pos.x / CELL_SIZE);
          var y = Math.floor(p.pos.y / CELL_SIZE);
          var cell = this.cellAt(x,y);
          if (cell) cell.add(p);
        },
        neighbours : function(x, y) {
          return [
            this.cellAt(x-1, y-1),
            this.cellAt(x  , y-1),
            this.cellAt(x+1, y-1),
            this.cellAt(x-1, y  ),
            this.cellAt(x+1, y  ),
            this.cellAt(x-1, y+1),
            this.cellAt(x  , y+1),
            this.cellAt(x+1, y+1)
          ];
        },
        cellAt : function(x, y) {
          if (x<0 || x>=this.cellWidth || y<0 || y>=this.cellHeight) {
            return null;
          }
          return this.cells[x][y];
        }
      };

      return ParticleSystem;
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
        addv: function(v) {
            this.x += v.x;
            this.y += v.y;
        },
        sub: function(x, y) {
            this.x -= x;
            this.y -= y;
        },
        subv: function(v) {
            this.x -= v.x;
            this.y -= v.y;
        },
        mult: function(n) {
            this.x *= n;
            this.y *= n;
        },
        multv: function(v) {
            this.x *= v.x;
            this.y *= v.y;
        },
        div: function(n) {
            this.x /= n;
            this.y /= n;
        },
        divv: function(v) {
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
        normalize : function() {
          var m = this.mag();
          if (m > 0) {
            this.div(m);
          }
        },
        limit: function(high) {
          var magsq = this.x*this.x + this.y*this.y;
          if (magsq > high*high) { 
              this.mult(high/Math.sqrt(magsq));
          }
        },
      };

      Vec2.add = function(v1, v2) {
        var v = v1.get();
        v.addv(v2);
        return v;
      }
      Vec2.sub = function(v1, v2) {
        var v = v1.get();
        v.subv(v2);
        return v;
      }
      Vec2.mult = function(v1, v2) {
        var v = v1.get();
        v.multv(v2);
        return v;
      }
      Vec2.div = function(v1, v2) {
        var v = v1.get();
        v.divv(v2);
        return v;
      }
      Vec2.dist = function(v1, v2) {
        return v1.dist(v2);
      };

      return Vec2;
    }());


    //-------------------------------------------
    // Utils

    function norm(val, low, high) {
      return (val - low) / (high - low);
    }

    function map(val, istart, iend, ostart, oend) {
      return ostart + (oend - ostart) * ((val - istart) / (iend - istart));
    }

    function chance(prob) {
      return prob > Math.random();
    }
}
