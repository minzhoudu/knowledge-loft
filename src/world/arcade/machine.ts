import { Game } from './game';
import { playArcade } from './sound';

/**
 * The one arcade machine, shared by the cabinet (which runs and draws it)
 * and the HUD (whose touch buttons play it on phones).
 */
export const machine = new Game(playArcade);

/** On-screen steering buttons (touch): held or not. */
export const pad = { left: false, right: false };
