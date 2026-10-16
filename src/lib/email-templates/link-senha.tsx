import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  nome?: string
  link?: string
  tipo?: 'primeiro-acesso' | 'redefinir'
}

const LinkSenhaEmail = ({ nome, link = '#', tipo = 'primeiro-acesso' }: Props) => {
  const redefinir = tipo === 'redefinir'
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{redefinir ? 'Redefina sua senha' : 'Crie sua senha de acesso'} — Gestão da Qualidade</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{redefinir ? 'Redefinição de senha' : 'Primeiro acesso'}</Heading>
          <Text style={text}>Olá{nome ? `, ${nome}` : ''}.</Text>
          <Text style={text}>
            {redefinir
              ? 'Recebemos um pedido para redefinir a senha da sua conta no Gestão da Qualidade. Clique no botão abaixo para escolher uma nova senha.'
              : 'Recebemos o pedido de primeiro acesso à sua conta no Gestão da Qualidade. Clique no botão abaixo para criar a sua senha.'}
          </Text>
          <Button style={button} href={link}>
            {redefinir ? 'Redefinir minha senha' : 'Criar minha senha'}
          </Button>
          <Text style={footer}>
            O link vale por 24 horas e só pode ser usado uma vez. Se você não fez este pedido, ignore este e-mail.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: LinkSenhaEmail,
  subject: (d) => (d.tipo === 'redefinir' ? 'Redefinição de senha — Gestão da Qualidade' : 'Primeiro acesso — Gestão da Qualidade'),
  displayName: 'Link de senha (primeiro acesso / redefinição)',
  previewData: { nome: 'Maria', link: 'https://gestaoqualidade.orcomacontabilidade.com.br/primeiro-acesso', tipo: 'primeiro-acesso' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '480px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0b1f4d', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const button = { backgroundColor: '#1E3A8A', color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, borderRadius: '8px', padding: '12px 24px', textDecoration: 'none', margin: '12px 0 8px' }
const footer = { fontSize: '12px', color: '#64748b', margin: '24px 0 0', lineHeight: '1.6' }
