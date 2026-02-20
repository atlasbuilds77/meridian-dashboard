import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function checkMeridian() {
  try {
    const { stdout } = await execAsync('ps aux | grep meridian_main.py | grep -v grep');
    return {
      name: 'Meridian',
      status: stdout ? 'online' : 'offline',
      lastUpdate: new Date().toISOString()
    };
  } catch {
    return {
      name: 'Meridian',
      status: 'offline',
      lastUpdate: null
    };
  }
}

async function checkHelios() {
  try {
    const response = await fetch('https://helios-px7f.onrender.com/health', {
      signal: AbortSignal.timeout(5000)
    });
    return {
      name: 'Helios',
      status: response.ok ? 'online' : 'degraded',
      lastUpdate: new Date().toISOString()
    };
  } catch {
    return {
      name: 'Helios',
      status: 'offline',
      lastUpdate: null
    };
  }
}

async function checkNebula() {
  try {
    const response = await fetch('https://nebula.zerogtrading.com/api/futures/prices?symbol=ES', {
      signal: AbortSignal.timeout(5000)
    });
    return {
      name: 'Nebula',
      status: response.ok ? 'online' : 'degraded',
      lastUpdate: new Date().toISOString()
    };
  } catch {
    return {
      name: 'Nebula',
      status: 'offline',
      lastUpdate: null
    };
  }
}

export async function GET() {
  try {
    const [meridian, helios, nebula] = await Promise.all([
      checkMeridian(),
      checkHelios(),
      checkNebula()
    ]);

    const systems = { meridian, helios, nebula };
    const allOnline = Object.values(systems).every(s => s.status === 'online');
    const anyDegraded = Object.values(systems).some(s => s.status === 'degraded');
    const anyOffline = Object.values(systems).some(s => s.status === 'offline');

    const overall = allOnline ? 'healthy' : anyOffline ? 'error' : 'degraded';

    return NextResponse.json({
      overall,
      systems,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { 
        overall: 'error',
        systems: {
          meridian: { name: 'Meridian', status: 'unknown', lastUpdate: null },
          helios: { name: 'Helios', status: 'unknown', lastUpdate: null },
          nebula: { name: 'Nebula', status: 'unknown', lastUpdate: null }
        },
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
