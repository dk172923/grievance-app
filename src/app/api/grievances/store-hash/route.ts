import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { supabase } from '@/lib/supabase';
import { getContract } from '@/utils/contract';

export async function POST(request: Request) {
  try {
    const { grievanceId, title, description, created_at } = await request.json();

    if (!grievanceId || !title || !description || !created_at) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Compute hash
    const dataString = `${grievanceId}${title}${description}${created_at}`;
    const hash = ethers.keccak256(ethers.toUtf8Bytes(dataString));

    // Get contract
    const contract = await getContract();

    // Store hash on blockchain
    const tx = await contract.storeHash(hash, {
      gasLimit: 500000,
      gasPrice: ethers.parseUnits('1', 'gwei'),
    });
    await tx.wait();

    // Update database
    const { error } = await supabase
      .from('grievances')
      .update({ blockchain_hash: hash })
      .eq('id', grievanceId);

    if (error) {
      console.error('Supabase update error:', error);
      return NextResponse.json({ error: 'Failed to store hash in database: ' + error.message }, { status: 500 });
    }

    return NextResponse.json({ hash }, { status: 200 });
  } catch (error: any) {
    console.error('Store hash error:', error);
    return NextResponse.json({ error: 'Failed to store hash: ' + error.message }, { status: 500 });
  }
}