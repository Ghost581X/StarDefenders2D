
import sdWorld from '../sdWorld.js';
import sdSound from '../sdSound.js';
import sdEntity from './sdEntity.js';
import sdEffect from './sdEffect.js';
import sdGun from './sdGun.js';
import sdWater from './sdWater.js';
import sdCom from './sdCom.js';
import sdBullet from './sdBullet.js';

class sdCube extends sdEntity
{
	static init_class()
	{
		sdCube.img_cube_idle = sdWorld.CreateImageFromFile( 'cube_idle' );
		sdCube.img_cube_hurt = sdWorld.CreateImageFromFile( 'cube_hurt' );
		sdCube.img_cube_attack = sdWorld.CreateImageFromFile( 'cube_attack' );
		sdCube.img_cube_sleep = sdWorld.CreateImageFromFile( 'cube_sleep' );
		
		sdCube.alive_cube_counter = 0;
		sdCube.alive_huge_cube_counter = 0;
		
		sdCube.death_duration = 10;
		sdCube.post_death_ttl = 90;
		
		sdCube.attack_range = 450;
		
		sdCube.huge_fitler = {};
		sdWorld.ReplaceColorInSDFilter( sdCube.huge_fitler, '#00fff6', '#ffff00' );
	
		sdWorld.entity_classes[ this.name ] = this; // Register for object spawn
	}
	get hitbox_x1() { return -5 * ( this.is_huge ? 2 : 1 ); }
	get hitbox_x2() { return 5 * ( this.is_huge ? 2 : 1 ); }
	get hitbox_y1() { return -5 * ( this.is_huge ? 2 : 1 ); }
	get hitbox_y2() { return 5 * ( this.is_huge ? 2 : 1 ); }
	
	get hard_collision() // For world geometry where players can walk
	{ return true; }
	
	constructor( params )
	{
		super( params );
		
		this.sx = 0;
		this.sy = 0;
		
		this.regen_timeout = 0;
		
		this.is_huge = params.is_huge || false;
		
		this._hmax = this.is_huge ? 800 : 200;
		this.hea = this._hmax;
		
		//this.death_anim = 0;
		
		//this._current_target = null;
		
		//this._last_stand_on = null;
		//this._last_jump = sdWorld.time;
		//this._last_bite = sdWorld.time;
		
		this._move_dir_x = 0;
		this._move_dir_y = 0;
		this._move_dir_timer = 0;
		
		this._attack_timer = 0;
		this.attack_anim = 0;
		//this._aggressive_mode = false; // Causes dodging and faster movement
		this._charged_shots = 3;
		
		//this.side = 1;
		
		this._alert_intensity = 0; // Grows until some value and only then it will shoot
		
		sdCube.alive_cube_counter++;
		
		if ( this.is_huge )
		sdCube.alive_huge_cube_counter++;
		
		//this.filter = 'hue-rotate(' + ~~( Math.random() * 360 ) + 'deg)';
	}
	/*SyncedToPlayer( character ) // Shortcut for enemies to react to players
	{
		if ( this.hea > 0 )
		if ( !character.ghosting )
		if ( character.hea > 0 )
		{
			
		}
	}*/
	/*GetBleedEffect()
	{
		return sdEffect.TYPE_BLOOD_GREEN;
	}*/
	/*GetBleedEffectFilter()
	{
		return this.filter;
	}*/
	Damage( dmg, initiator=null )
	{
		if ( !sdWorld.is_server )
		return;
	
	
		dmg = Math.abs( dmg );
		
		let was_alive = this.hea > 0;
		
		this.hea -= dmg;
		
		if ( this.hea > 0 )
		{
			if ( this.regen_timeout < 60 )
			sdSound.PlaySound({ name:'cube_hurt', pitch: this.is_huge ? 0.5 : 1, x:this.x, y:this.y, volume:0.66 });
		}
		
		this.regen_timeout = Math.max( this.regen_timeout, 60 );
		
		if ( this.hea <= 0 && was_alive )
		{
			this.regen_timeout = 30 * 15; // Stay dead for at least 15 seconds
			
			this._alert_intensity = 0;
			
			sdSound.PlaySound({ name:'cube_offline', pitch: this.is_huge ? 0.5 : 1, x:this.x, y:this.y, volume:1.5 });
		}
		
		if ( this.hea < -1000 )
		{
			sdWorld.SendEffect({ 
				x:this.x, 
				y:this.y, 
				radius:70, // 80 was too much?
				damage_scale: 4.5, // 5 was too deadly on relatively far range
				type:sdEffect.TYPE_EXPLOSION, 
				owner:this,
				color:'#33FFFF' 
			});

			if ( initiator )
			if ( initiator._socket )
			{
				if ( this.is_huge )
				initiator._socket.score += 80;
				else
				initiator._socket.score += 20;
			}

			this.remove();
		}
		
		//if ( this.hea < -this._hmax / 80 * 100 )
		//this.remove();
	}
	Impulse( x, y )
	{
		this.sx += x * 0.1 * ( this.is_huge ? 0.25 : 1 );
		this.sy += y * 0.1 * ( this.is_huge ? 0.25 : 1 );
	}
	Impact( vel ) // fall damage basically
	{
		// less fall damage
		if ( vel > 10 )
		{
			this.Damage( ( vel - 4 ) * 15 );
		}
	}
	onThink( GSPEED ) // Class-specific, if needed
	{
		if ( this.regen_timeout <= 0 )
		{
			if ( this.hea < this._hmax )
			{
				this.hea = Math.min( this.hea + GSPEED, this._hmax );
			}
		}
		else
		{
			this.regen_timeout = Math.max( this.regen_timeout - GSPEED, 0 );
		}
		
		if ( this.hea <= 0 )
		{
			this.sy += sdWorld.gravity * GSPEED;
		
			if ( this.death_anim < sdCube.death_duration + sdCube.post_death_ttl )
			this.death_anim += GSPEED;
			//else
			//this.remove();
		}
		else
		{
			this.sx = sdWorld.MorphWithTimeScale( this.sx, 0, 0.87, GSPEED );
			this.sy = sdWorld.MorphWithTimeScale( this.sy, 0, 0.87, GSPEED );
			
			if ( sdWorld.is_server )
			{
				if ( this._move_dir_timer <= 0 )
				{
					this._move_dir_timer = 15 + Math.random() * 45;

					let closest = null;
					let closest_di = Infinity;

					for ( let i = 0; i < sdWorld.sockets.length; i++ )
					{
						if ( sdWorld.sockets[ i ].character )
						if ( sdWorld.sockets[ i ].character.hea > 0 )
						if ( !sdWorld.sockets[ i ].character._is_being_removed )
						{
							let di = sdWorld.Dist2D( this.x, this.y, sdWorld.sockets[ i ].character.x, sdWorld.sockets[ i ].character.y );
							if ( di < closest_di )
							{
								closest_di = di;
								closest = sdWorld.sockets[ i ].character;
							}
						}
					}

					if ( closest )
					{
						// Get closer
						let an_desired = Math.atan2( closest.y - this.y, closest.x - this.x ) - 0.5 + Math.random();

						this._move_dir_x = Math.cos( an_desired ) * 3;
						this._move_dir_y = Math.sin( an_desired ) * 3;
						
						if ( closest_di < sdCube.attack_range ) // close enough to dodge obstacles
						{
							let an = Math.random() * Math.PI * 2;

							this._move_dir_x = Math.cos( an );
							this._move_dir_y = Math.sin( an );

							if ( !sdWorld.CheckLineOfSight( this.x, this.y, closest.x, closest.y, this, sdCom.com_visibility_ignored_classes, null ) )
							{
								for ( let ideas = Math.max( 5, 40 / sdCube.alive_cube_counter ); ideas > 0; ideas-- )
								{
									var a1 = Math.random() * Math.PI * 2;
									var r1 = Math.random() * 200;

									var a2 = Math.random() * Math.PI * 2;
									var r2 = Math.random() * 200;

									if ( sdWorld.CheckLineOfSight( this.x, this.y, this.x + Math.cos( a1 ) * r1, this.y + Math.sin( a1 ) * r1, this, sdCom.com_visibility_ignored_classes, null ) )
									{
										if ( sdWorld.CheckLineOfSight( closest.x, closest.y, this.x + Math.cos( a1 ) * r1, this.y + Math.sin( a1 ) * r1, this, sdCom.com_visibility_ignored_classes, null ) )
										{
											// Can attack from position 1

											this._move_dir_x = Math.cos( a1 );
											this._move_dir_y = Math.sin( a1 );

											this._move_dir_timer = r1 * 5;

											//sdWorld.SendEffect({ x:this.x + Math.cos( a1 ) * r1, y:this.y + Math.sin( a1 ) * r1, type:sdEffect.TYPE_WALL_HIT });
											break;
										}
										else
										{
											if ( sdWorld.CheckLineOfSight( this.x + Math.cos( a1 ) * r1, 
																		   this.y + Math.sin( a1 ) * r1, 
																		   this.x + Math.cos( a1 ) * r1 + Math.cos( a2 ) * r2, 
																		   this.y + Math.sin( a1 ) * r1 + Math.sin( a2 ) * r2, this, sdCom.com_visibility_ignored_classes, null ) )
											{
												if ( sdWorld.CheckLineOfSight( closest.x, closest.y, 
																			   this.x + Math.cos( a1 ) * r1 + Math.cos( a2 ) * r2, 
																			   this.y + Math.sin( a1 ) * r1 + Math.sin( a2 ) * r2, this, sdCom.com_visibility_ignored_classes, null ) )
												{
													// Can attack from position 2, but will move to position 1 still

													this._move_dir_x = Math.cos( a1 );
													this._move_dir_y = Math.sin( a1 );

													this._move_dir_timer = r1 * 5;
													
													break;
												}
											}
										}
									}
								}
							}
							else
							{

								//sdWorld.SendEffect({ x:this.x, y:this.y, type:sdEffect.TYPE_WALL_HIT });
							
							}
						}
					}
					else
					{
						let an = Math.random() * Math.PI * 2;

						this._move_dir_x = Math.cos( an );
						this._move_dir_y = Math.sin( an );
					}
				}
				else
				this._move_dir_timer -= GSPEED;
			}
		
			let v = ( this.attack_anim > 0 ) ? 0.3 : 0.1;
				
			if ( 
					this.y > sdWorld.world_bounds.y1 + 200 &&
					sdWorld.CheckLineOfSight( this.x, this.y, this.x + this._move_dir_x * 50, this.y + this._move_dir_y * 50, this, sdCom.com_visibility_ignored_classes, null ) &&  // Can move forward
				( 
				   !sdWorld.CheckLineOfSight( this.x, this.y, this.x + this._move_dir_x * 200, this.y + this._move_dir_y * 200, this, sdCom.com_visibility_ignored_classes, null ) || // something is in front in distance
				   !sdWorld.CheckLineOfSight( this.x, this.y, this.x - this._move_dir_x * 100, this.y - this._move_dir_y * 100, this, sdCom.com_visibility_ignored_classes, null ) || // allow retreat from wall behind
				   !sdWorld.CheckLineOfSight( this.x, this.y, this.x - this._move_dir_y * 100, this.y + this._move_dir_x * 100, this, sdCom.com_visibility_ignored_classes, null ) || // side
				   !sdWorld.CheckLineOfSight( this.x, this.y, this.x + this._move_dir_y * 100, this.y - this._move_dir_x * 100, this, sdCom.com_visibility_ignored_classes, null ) // side
				   ) )
			{
				
				this.sx += this._move_dir_x * v * GSPEED;
				this.sy += this._move_dir_y * v * GSPEED;
			}
			else
			{
				this._move_dir_timer = 0;
				this.sy += 0.03 * GSPEED;
			}
			
			if ( sdWorld.is_server )
			{
				if ( this._attack_timer <= 0 )
				{
					this._attack_timer = 3;

					//let targets_raw = sdWorld.GetAnythingNear( this.x, this.y, 800 );
					//let targets_raw = sdWorld.GetCharactersNear( this.x, this.y, null, null, 800 );
					let targets_raw = sdWorld.GetAnythingNear( this.x, this.y, sdCube.attack_range, null, [ 'sdCharacter', 'sdTurret' ] );

					let targets = [];

					for ( let i = 0; i < targets_raw.length; i++ )
					if ( ( targets_raw[ i ].GetClass() === 'sdCharacter' && targets_raw[ i ].hea > 0 ) ||
						   targets_raw[ i ].GetClass() === 'sdTurret' )
					if ( sdWorld.CheckLineOfSight( this.x, this.y, targets_raw[ i ].x, targets_raw[ i ].y, targets_raw[ i ], [ 'sdCube' ], [ 'sdBlock', 'sdDoor', 'sdMatterContainer' ] ) )
					targets.push( targets_raw[ i ] );

					sdWorld.shuffleArray( targets );

					for ( let i = 0; i < targets.length; i++ )
					{
						if ( this._alert_intensity < 45 || // Delay attack
							 ( this.regen_timeout > 45 && !this.is_huge ) ) // Hurt stun
						break;

						this.attack_anim = 15;

						let an = Math.atan2( targets[ i ].y - this.y, targets[ i ].x - this.x );

						let bullet_obj = new sdBullet({ x: this.x, y: this.y });
						bullet_obj._owner = this;
						bullet_obj.sx = Math.cos( an );
						bullet_obj.sy = Math.sin( an );
						//bullet_obj.x += bullet_obj.sx * 5;
						//bullet_obj.y += bullet_obj.sy * 5;

						bullet_obj.sx *= 16;
						bullet_obj.sy *= 16;
						
						bullet_obj.time_left = 60;

						bullet_obj._rail = true;

						bullet_obj._damage = 15;
						bullet_obj.color = '#ffffff';

						sdEntity.entities.push( bullet_obj );

						this._charged_shots--;

						if ( this._charged_shots <= 0 )
						{
							this._charged_shots = 3;
							this._attack_timer = 45;
						}

						sdSound.PlaySound({ name:'cube_attack', pitch: this.is_huge ? 0.5 : 1, x:this.x, y:this.y, volume:0.5 });

						break;
					}

					if ( targets.length === 0 ) // lower seek rate when no targets around
					this._attack_timer = 25 + Math.random() * 10;
					else
					{
						if ( this._alert_intensity === 0 )
						{
							this._alert_intensity = 0.0001;
							sdSound.PlaySound({ name:'cube_alert2', pitch: this.is_huge ? 0.5 : 1, x:this.x, y:this.y, volume:1 });
						}
					}
				}
				else
				this._attack_timer -= GSPEED;
			}
		
			if ( this.attack_anim > 0 )
			this.attack_anim = Math.max( 0, this.attack_anim - GSPEED );
		}
		
		if ( this._alert_intensity > 0 )
		if ( this._alert_intensity < 45 )
		{
			this._alert_intensity += GSPEED;
		}
			
		this.ApplyVelocityAndCollisions( GSPEED, 0, true );
	}
	DrawHUD( ctx, attached ) // foreground layer
	{
		//if ( this.death_anim === 0 )
		sdEntity.Tooltip( ctx, "Cube" );
	}
	Draw( ctx, attached )
	{
		//ctx.filter = this.filter;
		
		if ( this.is_huge )
		{
			ctx.scale( 2, 2 );
			//ctx.filter = 'hue-rotate(90deg)';
			ctx.sd_filter = sdCube.huge_fitler;
		}
		
		if ( this.hea > 0 )
		{
			if ( this.attack_anim > 0 )
			{
				ctx.drawImageFilterCache( sdCube.img_cube_attack, - 16, - 16, 32,32 );
			}
			else
			if ( this.regen_timeout > 45 )
			ctx.drawImageFilterCache( sdCube.img_cube_hurt, - 16, - 16, 32,32 );
			else
			ctx.drawImageFilterCache( sdCube.img_cube_idle, - 16, - 16, 32,32 );
		}
		else
		ctx.drawImageFilterCache( sdCube.img_cube_sleep, - 16, - 16, 32,32 );
		
		ctx.globalAlpha = 1;
		//ctx.filter = 'none';
		ctx.sd_filter = null;
	}
	/*onMovementInRange( from_entity )
	{
		//this._last_stand_on = from_entity;
	}*/
	onRemove() // Class-specific, if needed
	{
		sdCube.alive_cube_counter--;
		
		if ( this.is_huge )
		sdCube.alive_huge_cube_counter--;
		
		//sdSound.PlaySound({ name:'crystal', x:this.x, y:this.y, volume:1 });
	}
	MeasureMatterCost()
	{
		return 500; // Hack
	}
}
//sdCube.init_class();

export default sdCube;